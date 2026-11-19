import type { Metadata } from "next";
import HistoryList from "@/components/HistoryList";

export const metadata: Metadata = { title: "Lịch sử làm bài" };

export default function HistoryPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Lịch sử làm bài</h1>
      <p className="mt-2 text-sm text-muted">Bài làm đang được lưu trên trình duyệt này.</p>
      <HistoryList />
    </main>
  );
}
