import type { Metadata } from "next";
import { Suspense } from "react";
import ClientOnly from "@/components/ClientOnly";
import VocabHub from "@/components/VocabHub";
import { getPhrases, getTestIndex, getVocab } from "@/lib/tests";
import { CardsSkeleton } from "@/components/Skeleton";

export const metadata: Metadata = { title: "Từ vựng" };

const loading = <CardsSkeleton label="Đang tải từ vựng" cards={6} />;

export default async function VocabularyPage() {
  const [vocab, tests, phrases] = await Promise.all([getVocab(), getTestIndex(), getPhrases()]);
  const learnable = vocab.filter((v) => !v.basic).length;
  const phraseCount = phrases.reduce((n, g) => n + g.items.length, 0);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Từ vựng TOEIC</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {learnable.toLocaleString("vi-VN")} từ TOEIC chia theo {tests.length} đề (mỗi đề khoảng 50–90 từ, kèm câu ví dụ từ chính đề)
        {phraseCount > 0 && <> và {phraseCount.toLocaleString("vi-VN")} cụm từ đi với giới từ</>}. Học bằng thẻ ghi nhớ với lịch ôn ngắt
        quãng.
      </p>
      <Suspense fallback={loading}>
        <ClientOnly fallback={loading}>
          <VocabHub tests={tests.map((t) => ({ id: t.id, year: t.year, number: t.number }))} />
        </ClientOnly>
      </Suspense>
    </main>
  );
}
