import type { Metadata } from "next";
import { Suspense } from "react";
import ClientOnly from "@/components/ClientOnly";
import VocabTrainer from "@/components/VocabTrainer";
import { getTestIndex, getVocab } from "@/lib/tests";
import { CardsSkeleton } from "@/components/Skeleton";

export const metadata: Metadata = { title: "Từ vựng" };

const loading = <CardsSkeleton label="Đang tải từ vựng" cards={6} />;

export default async function VocabularyPage() {
  const [vocab, tests] = await Promise.all([getVocab(), getTestIndex()]);
  const learnable = vocab.filter((v) => !v.basic).length;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Từ vựng TOEIC</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {learnable.toLocaleString("vi-VN")} từ TOEIC chia theo {tests.length} đề, mỗi đề khoảng 50–90 từ: phần đọc lấy các phương án của câu
        hỏi từ vựng Part 5 (và đáp án câu từ loại, liên từ – giới từ), phần nghe lấy những từ trong lời thoại thường được hỏi trong đề thi.
        Kèm câu ví dụ từ chính đề, học bằng thẻ ghi nhớ với lịch ôn ngắt quãng.
      </p>
      <Suspense fallback={loading}>
        <ClientOnly fallback={loading}>
          <VocabTrainer tests={tests.map((t) => ({ id: t.id, year: t.year, number: t.number }))} />
        </ClientOnly>
      </Suspense>
    </main>
  );
}
