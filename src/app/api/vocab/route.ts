// Toàn bộ từ vựng (prerender sẵn) — trang Từ vựng tải ở phía client để HTML không phải nhúng ~1 MB dữ liệu
import { getVocab } from "@/lib/tests";

export async function GET() {
  return Response.json(await getVocab());
}
