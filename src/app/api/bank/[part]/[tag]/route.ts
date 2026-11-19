// Toàn bộ câu của một dạng (Part 2/5) — prerender sẵn, client tự chọn ngẫu nhiên
import { getBank, getBankIndex } from "@/lib/tests";

export async function generateStaticParams() {
  return (await getBankIndex()).map((t) => ({ part: String(t.part), tag: t.tag }));
}

export async function GET(_request: Request, ctx: RouteContext<"/api/bank/[part]/[tag]">) {
  const { part, tag } = await ctx.params;
  const items = await getBank(part, tag);
  if (!items) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(items);
}
