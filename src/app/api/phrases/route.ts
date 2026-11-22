// Cụm từ đi với giới từ (prerender sẵn) — mục "Cụm giới từ" trong trang Từ vựng tải ở phía client khi mở
import { getPhrases } from "@/lib/tests";

export async function GET() {
  return Response.json(await getPhrases());
}
