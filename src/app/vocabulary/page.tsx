import type { Metadata } from "next";
import { Suspense } from "react";
import ClientOnly from "@/components/ClientOnly";
import VocabTrainer from "@/components/VocabTrainer";
import { getTestIndex, getVocab } from "@/lib/tests";

export const metadata: Metadata = { title: "Từ vựng" };

const loading = <p className="mt-8 text-muted">Đang tải…</p>;

export default async function VocabularyPage() {
  const [vocab, tests] = await Promise.all([getVocab(), getTestIndex()]);
  const learnable = vocab.filter((v) => !v.basic).length;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Từ vựng TOEIC</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {learnable.toLocaleString("vi-VN")} từ (kèm các dạng danh từ, động từ, tính từ…) từ phần nghe và phần đọc của {tests.length} đề, chia theo
        từng đề, kèm câu ví dụ lấy từ chính đề thi. Học bằng thẻ ghi nhớ với lịch ôn ngắt quãng.
      </p>
      <Suspense fallback={loading}>
        <ClientOnly fallback={loading}>
          <VocabTrainer tests={tests.map((t) => ({ id: t.id, year: t.year, number: t.number }))} />
        </ClientOnly>
      </Suspense>
    </main>
  );
}
