// JSON của một đề cho các trang phía client (sổ câu sai, luyện nghe) — prerender sẵn cả 50 đề
import { getTest, getTestIndex } from "@/lib/tests";

export async function generateStaticParams() {
  return (await getTestIndex()).map((t) => ({ id: t.id }));
}

export async function GET(_request: Request, ctx: RouteContext<"/api/tests/[id]">) {
  const test = await getTest((await ctx.params).id);
  if (!test) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(test);
}
