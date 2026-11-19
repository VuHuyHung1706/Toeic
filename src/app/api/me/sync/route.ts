import { getDb } from "@/db";
import { applyOps, getSnapshot, syncBodySchema } from "@/db/userdata";
import { getSessionUser } from "@/lib/auth";
import type { SyncOp } from "@/lib/sync-types";

// Dữ liệu học của người đang đăng nhập.
// GET  → toàn bộ dữ liệu (UserSnapshot)
// POST { ops: SyncOp[] } → áp các thay đổi (idempotent)

const MAX_BODY = 4_000_000; // dưới giới hạn 4,5 MB của Vercel
const noStore = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

export async function GET(req: Request) {
  const user = await getSessionUser(req.headers);
  if (!user) return json({ error: "unauthorized" }, 401);
  return json(await getSnapshot(await getDb(), user.id));
}

export async function POST(req: Request) {
  // bắt buộc JSON: trình duyệt phải preflight nếu gửi từ trang khác (chống CSRF)
  if (!req.headers.get("content-type")?.startsWith("application/json")) return json({ error: "json required" }, 415);
  const user = await getSessionUser(req.headers);
  if (!user) return json({ error: "unauthorized" }, 401);

  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: "too large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const parsed = syncBodySchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid ops", issues: parsed.error.issues.slice(0, 5) }, 400);

  const applied = await applyOps(await getDb(), user.id, parsed.data.ops as SyncOp[]);
  return json({ ok: true, applied });
}
