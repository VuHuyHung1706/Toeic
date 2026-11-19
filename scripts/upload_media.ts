// Tải audio/ảnh mà content/ dùng tới (trong Data/) lên bucket Backblaze B2, giữ nguyên đường dẫn.
// Chạy lại được nhiều lần: file đã có trên bucket với cùng SHA-1 sẽ được bỏ qua.
//
//   npm run media:upload -- --dry-run     # chỉ liệt kê sẽ tải gì
//   npm run media:upload
//
// Cần trong .env.local (KHÔNG commit, không dán vào chat):
//   B2_KEY_ID=...        # Application Key ID (Backblaze → Application Keys)
//   B2_APP_KEY=...       # applicationKey (chỉ hiện một lần khi tạo key)
//   B2_BUCKET=...        # tên bucket (Public)
// Dùng B2 Native API v2 bằng fetch — không cần cài CLI.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.resolve(process.env.TOEIC_DATA_DIR ?? path.join(ROOT, "Data"));
const CONTENT = path.join(ROOT, "content");
const CONCURRENCY = 6;
const TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

try {
  process.loadEnvFile(".env.local");
} catch {
  /* không có .env.local */
}
const dryRun = process.argv.includes("--dry-run");

function need(name: string) {
  const v = process.env[name];
  if (!v) {
    console.error(`Thiếu ${name} (đặt trong .env.local)`);
    process.exit(1);
  }
  return v;
}

/** Mọi đường dẫn media mà dữ liệu đề tham chiếu ("src": "...") */
function referencedMedia(): string[] {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".json"))
        for (const m of readFileSync(p, "utf8").matchAll(/"src":\s*"([^"]+)"/g)) out.add(JSON.parse(`"${m[1]}"`));
    }
  };
  walk(CONTENT);
  return [...out].filter((s) => path.extname(s).toLowerCase() in TYPES).sort();
}

interface Auth {
  apiUrl: string;
  downloadUrl: string;
  authorizationToken: string;
  accountId: string;
  allowed?: { bucketId?: string | null; bucketName?: string | null };
}

async function api<T>(auth: Auth, name: string, body: unknown): Promise<T> {
  const res = await fetch(`${auth.apiUrl}/b2api/v2/${name}`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Tên file B2: mã hoá từng ký tự trừ "/" (theo tài liệu B2) */
const encodeName = (s: string) => s.split("/").map(encodeURIComponent).join("/");

async function main() {
  const keyId = need("B2_KEY_ID");
  const appKey = need("B2_APP_KEY");
  const bucketName = need("B2_BUCKET");

  const files = referencedMedia();
  const missing = files.filter((f) => !statSync(path.join(DATA, f), { throwIfNoEntry: false })?.isFile());
  if (missing.length) {
    console.error(`${missing.length} file không có trong ${DATA}, vd: ${missing.slice(0, 3).join(", ")}`);
    process.exit(1);
  }

  const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: "Basic " + Buffer.from(`${keyId}:${appKey}`).toString("base64") },
  });
  if (!authRes.ok) throw new Error(`Đăng nhập B2 thất bại: ${authRes.status} ${await authRes.text()}`);
  const auth = (await authRes.json()) as Auth;

  let bucketId = auth.allowed?.bucketName === bucketName ? auth.allowed.bucketId : null;
  if (!bucketId) {
    const { buckets } = await api<{ buckets: { bucketId: string; bucketType: string }[] }>(auth, "b2_list_buckets", {
      accountId: auth.accountId,
      bucketName,
    });
    if (!buckets.length) throw new Error(`Không thấy bucket "${bucketName}" (hoặc key không có quyền)`);
    bucketId = buckets[0].bucketId;
    if (buckets[0].bucketType !== "allPublic") console.warn(`⚠ Bucket đang "${buckets[0].bucketType}" — cần "Public" để trình duyệt phát được.`);
  }

  // file đã có trên bucket
  const existing = new Map<string, { sha1: string; size: number }>();
  let startFileName: string | null = null;
  do {
    const r: { files: { fileName: string; contentSha1: string; contentLength: number; fileInfo?: Record<string, string> }[]; nextFileName: string | null } =
      await api(auth, "b2_list_file_names", { bucketId, startFileName, maxFileCount: 10000 });
    for (const f of r.files)
      existing.set(f.fileName, { sha1: f.fileInfo?.large_file_sha1 ?? f.contentSha1, size: f.contentLength });
    startFileName = r.nextFileName;
  } while (startFileName);

  const todo: { name: string; size: number }[] = [];
  let skipped = 0;
  for (const name of files) {
    const size = statSync(path.join(DATA, name)).size;
    const cur = existing.get(name);
    if (cur && cur.size === size) {
      const sha1 = createHash("sha1").update(readFileSync(path.join(DATA, name))).digest("hex");
      if (sha1 === cur.sha1) {
        skipped++;
        continue;
      }
    }
    todo.push({ name, size });
  }
  const totalBytes = todo.reduce((s, f) => s + f.size, 0);
  console.log(`${files.length} file media · đã có ${skipped} · cần tải ${todo.length} (${(totalBytes / 1e6).toFixed(0)} MB)`);
  const base = `${auth.downloadUrl}/file/${bucketName}`;
  if (dryRun || !todo.length) {
    console.log(`NEXT_PUBLIC_MEDIA_BASE=${base}`);
    return;
  }

  let done = 0;
  let doneBytes = 0;
  const t0 = Date.now();
  const queue = [...todo];
  async function worker() {
    let up: { uploadUrl: string; authorizationToken: string } | null = null;
    for (let item = queue.shift(); item; item = queue.shift()) {
      const body = await readFile(path.join(DATA, item.name));
      const sha1 = createHash("sha1").update(body).digest("hex");
      for (let attempt = 1; ; attempt++) {
        let status = 0;
        let msg = "";
        try {
          up ??= await api<{ uploadUrl: string; authorizationToken: string }>(auth, "b2_get_upload_url", { bucketId });
          const res = await fetch(up.uploadUrl, {
            method: "POST",
            headers: {
              Authorization: up.authorizationToken,
              "X-Bz-File-Name": encodeName(item.name),
              "Content-Type": TYPES[path.extname(item.name).toLowerCase()],
              "Content-Length": String(body.length),
              "X-Bz-Content-Sha1": sha1,
              // media không đổi nội dung theo tên → cho trình duyệt/CDN cache lâu
              "X-Bz-Info-b2-cache-control": encodeURIComponent("public, max-age=31536000, immutable"),
            },
            body,
          });
          if (res.ok) break;
          status = res.status;
          msg = await res.text();
        } catch (e) {
          msg = (e as Error).message; // lỗi mạng
        }
        // lỗi mạng / 401 / 408 / 429 / 5xx: lấy upload URL mới rồi thử lại (theo khuyến nghị của B2)
        const retryable = status === 0 || [401, 408, 429].includes(status) || status >= 500;
        if (!retryable || attempt >= 5) throw new Error(`Tải ${item.name} thất bại: ${status} ${msg}`);
        up = null;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
      done++;
      doneBytes += item.size;
      if (done % 50 === 0 || done === todo.length) {
        const mbps = doneBytes / 1e6 / ((Date.now() - t0) / 1000);
        console.log(`  ${done}/${todo.length} · ${(doneBytes / 1e6).toFixed(0)}/${(totalBytes / 1e6).toFixed(0)} MB · ${mbps.toFixed(1)} MB/s`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Xong. Đặt trên Vercel: NEXT_PUBLIC_MEDIA_BASE=${base}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
