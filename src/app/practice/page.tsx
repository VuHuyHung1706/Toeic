import type { Metadata } from "next";
import ClientOnly from "@/components/ClientOnly";
import PracticeHub from "@/components/PracticeHub";
import { getBankIndex } from "@/lib/tests";

export const metadata: Metadata = { title: "Luyện theo dạng câu" };

export default async function PracticePage() {
  const index = await getBankIndex();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Luyện theo dạng câu</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Câu hỏi Part 2 được nhóm theo loại câu hỏi, Part 5 theo chủ điểm ngữ pháp — gom từ cả 50 đề. Chọn một dạng để luyện
        tập trung; câu làm sai tự động vào sổ câu sai.
      </p>
      <ClientOnly fallback={<p className="mt-8 text-muted">Đang tải…</p>}>
        <PracticeHub index={index} />
      </ClientOnly>
    </main>
  );
}
