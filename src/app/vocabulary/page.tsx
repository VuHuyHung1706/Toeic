import type { Metadata } from "next";
import ClientOnly from "@/components/ClientOnly";
import VocabTrainer from "@/components/VocabTrainer";
import { getVocab } from "@/lib/tests";

export const metadata: Metadata = { title: "Từ vựng" };

export default async function VocabularyPage() {
  const vocab = await getVocab();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Từ vựng TOEIC</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {vocab.length.toLocaleString("vi-VN")} từ trích từ phần giải thích Part 5–6 của 50 đề, xếp theo tần suất xuất hiện, kèm câu
        ví dụ lấy từ chính đề thi. Học bằng thẻ ghi nhớ với lịch ôn ngắt quãng.
      </p>
      <ClientOnly fallback={<p className="mt-8 text-muted">Đang tải…</p>}>
        <VocabTrainer vocab={vocab} />
      </ClientOnly>
    </main>
  );
}
