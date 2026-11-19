// Phục vụ audio/ảnh:
// - Mặc định: đọc từ thư mục Data/ (hỗ trợ HTTP Range để tua audio) — dùng khi chạy trên máy.
// - MEDIA_SOURCE=b2 (khi deploy): chuyển hướng 302 tới bucket Backblaze B2 riêng tư kèm giấy phép tải có hạn.
//   Đường dẫn /media/... của trang giữ nguyên → trình duyệt vẫn cache được; Range/tua do B2 xử lý.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { REDIRECT_MAX_AGE_SEC, b2Enabled, signedMediaUrl } from "@/lib/b2";

// turbopackIgnore: không để bundler "trace" cả thư mục Data (1,7 GB) vào bản build
const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.TOEIC_DATA_DIR ?? path.join(process.cwd(), "Data"));

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function notFound() {
  return new Response("Not found", { status: 404 });
}

/**
 * Stream file có kiểm soát backpressure và huỷ: trình duyệt thường bỏ ngang request audio
 * (tua, đổi câu) — khi đó phải đóng file stream thay vì tiếp tục enqueue vào stream đã đóng.
 */
function fileStream(file: string, opts?: { start: number; end: number }): ReadableStream<Uint8Array> {
  const node = createReadStream(file, opts);
  let done = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on("data", (chunk) => {
        if (done) return;
        try {
          controller.enqueue(new Uint8Array(chunk as Buffer));
          if ((controller.desiredSize ?? 1) <= 0) node.pause();
        } catch {
          done = true;
          node.destroy();
        }
      });
      node.on("end", () => {
        if (done) return;
        done = true;
        try {
          controller.close();
        } catch {}
      });
      node.on("error", (err) => {
        if (done) return;
        done = true;
        try {
          controller.error(err);
        } catch {}
      });
    },
    pull() {
      node.resume();
    },
    cancel() {
      done = true;
      node.destroy();
    },
  });
}

export async function GET(request: Request, ctx: RouteContext<"/media/[...path]">) {
  const { path: segments } = await ctx.params;
  let decoded: string[];
  try {
    decoded = segments.map((s) => decodeURIComponent(s));
  } catch {
    return notFound(); // %-encoding sai (vd "%E0")
  }
  if (decoded.some((s) => !s || s === "." || s === ".." || s.includes("/") || s.includes("\\"))) return notFound();
  const file = path.resolve(/*turbopackIgnore: true*/ DATA_DIR, ...decoded);
  if (!file.startsWith(DATA_DIR + path.sep)) return notFound();
  const type = CONTENT_TYPES[path.extname(file).toLowerCase()];
  if (!type) return notFound();

  if (b2Enabled()) {
    try {
      const location = await signedMediaUrl(decoded.map(encodeURIComponent).join("/"));
      return new Response(null, {
        status: 302,
        headers: { Location: location, "Cache-Control": `private, max-age=${REDIRECT_MAX_AGE_SEC}` },
      });
    } catch (e) {
      console.error("B2 media:", e);
      return new Response("Media tạm thời không khả dụng", { status: 503, headers: { "Retry-After": "30" } });
    }
  }

  let size: number;
  try {
    const st = await stat(file);
    if (!st.isFile()) return notFound();
    size = st.size;
  } catch {
    return notFound();
  }

  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  };

  const range = request.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start: number;
    let end: number;
    if (m[1]) {
      start = Number(m[1]);
      end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    } else {
      // bytes=-N : N byte cuối
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(fileStream(file, { start, end }), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(fileStream(file), {
    status: 200,
    headers: { ...headers, "Content-Length": String(size) },
  });
}
