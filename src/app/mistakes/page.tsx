import type { Metadata } from "next";
import ClientOnly from "@/components/ClientOnly";
import MistakeBook from "@/components/MistakeBook";
import { CardsSkeleton } from "@/components/Skeleton";

export const metadata: Metadata = { title: "Sổ câu sai" };

export default function MistakesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Sổ câu sai</h1>
      <p className="mt-2 text-muted">
        Tự động gom các câu bạn làm sai trong thi thử, luyện tập và luyện theo dạng, rồi hẹn ngày ôn lại theo kiểu ôn tập
        ngắt quãng cho tới khi thuộc.
      </p>
      <ClientOnly fallback={<CardsSkeleton label="Đang tải sổ câu sai" cards={4} />}>
        <MistakeBook />
      </ClientOnly>
    </main>
  );
}
