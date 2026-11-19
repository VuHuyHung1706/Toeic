// Cấp "giấy phép tải" cho bucket Backblaze B2 riêng tư (Private) — chỉ dùng phía server.
// /media/... trả 302 tới https://<downloadUrl>/file/<bucket>/<file>?Authorization=<token>.
// Token dùng chung cho cả bucket, hạn 7 ngày, giữ trong bộ nhớ của instance (mỗi lần khởi động: 2 lệnh gọi API B2).
// Bật bằng MEDIA_SOURCE=b2 + B2_KEY_ID / B2_APP_KEY / B2_BUCKET (key nên chỉ có quyền Read Only trên bucket).

const TOKEN_TTL_SEC = 7 * 24 * 3600; // tối đa B2 cho phép
const RENEW_BEFORE_MS = 2 * 24 * 3600 * 1000; // còn < 2 ngày thì xin token mới
/** Thời gian trình duyệt được giữ lệnh chuyển hướng (luôn ngắn hơn phần hạn còn lại của token) */
export const REDIRECT_MAX_AGE_SEC = 24 * 3600;

export const b2Enabled = () =>
  process.env.MEDIA_SOURCE === "b2" && !!(process.env.B2_KEY_ID && process.env.B2_APP_KEY && process.env.B2_BUCKET);

interface Grant {
  base: string; // https://f005.backblazeb2.com/file/<bucket>
  token: string;
  expiresAt: number;
}

const g = globalThis as unknown as { __b2Grant?: Promise<Grant> };

async function fetchGrant(): Promise<Grant> {
  const bucketName = process.env.B2_BUCKET!;
  const basic = Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APP_KEY}`).toString("base64");
  const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });
  if (!authRes.ok) throw new Error(`b2_authorize_account ${authRes.status}`);
  const auth = (await authRes.json()) as {
    apiUrl: string;
    downloadUrl: string;
    authorizationToken: string;
    accountId: string;
    allowed?: { bucketId?: string | null; bucketName?: string | null };
  };

  let bucketId = auth.allowed?.bucketName === bucketName ? auth.allowed.bucketId : null;
  if (!bucketId) {
    const r = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
      method: "POST",
      headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: auth.accountId, bucketName }),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`b2_list_buckets ${r.status}`);
    bucketId = ((await r.json()) as { buckets: { bucketId: string }[] }).buckets[0]?.bucketId ?? null;
    if (!bucketId) throw new Error(`Không thấy bucket ${bucketName}`);
  }

  const startedAt = Date.now();
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId, fileNamePrefix: "", validDurationInSeconds: TOKEN_TTL_SEC }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`b2_get_download_authorization ${res.status} ${await res.text()}`);
  const { authorizationToken } = (await res.json()) as { authorizationToken: string };
  return {
    base: `${auth.downloadUrl}/file/${encodeURIComponent(bucketName)}`,
    token: authorizationToken,
    expiresAt: startedAt + TOKEN_TTL_SEC * 1000,
  };
}

async function getGrant(): Promise<Grant> {
  const cur = g.__b2Grant && (await g.__b2Grant.catch(() => null));
  if (cur && cur.expiresAt - Date.now() > RENEW_BEFORE_MS) return cur;
  const next = fetchGrant();
  g.__b2Grant = next;
  next.catch(() => {
    if (g.__b2Grant === next) g.__b2Grant = undefined;
  });
  return next;
}

/** URL tải có giấy phép cho một file (encodedPath: các đoạn đường dẫn đã mã hoá, nối bằng "/") */
export async function signedMediaUrl(encodedPath: string): Promise<string> {
  const { base, token } = await getGrant();
  return `${base}/${encodedPath}?Authorization=${encodeURIComponent(token)}`;
}
