import type { Metadata } from "next";
import ClientOnly from "@/components/ClientOnly";
import ListeningPractice from "@/components/ListeningPractice";
import { getTestIndex } from "@/lib/tests";

export const metadata: Metadata = { title: "Luyện nghe chép chính tả" };

export default async function ListeningPage() {
  const tests = await getTestIndex();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Luyện nghe chép chính tả</h1>
      <p className="mt-2 text-muted">
        Nghe audio Part 1–4 rồi điền từ bị ẩn hoặc chép lại cả câu. Có thể nghe lại, chỉnh tốc độ và chọn độ khó.
      </p>
      <ClientOnly fallback={<p className="mt-8 text-muted">Đang tải…</p>}>
        <ListeningPractice tests={tests.map((t) => ({ id: t.id, year: t.year, number: t.number }))} />
      </ClientOnly>
    </main>
  );
}
