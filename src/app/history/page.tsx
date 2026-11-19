import type { Metadata } from "next";
import { StorageNote } from "@/components/AccountMenu";
import ClientOnly from "@/components/ClientOnly";
import HistoryList from "@/components/HistoryList";
import ProgressDashboard from "@/components/ProgressDashboard";

export const metadata: Metadata = { title: "Tiến độ học tập" };

export default function HistoryPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Tiến độ học tập</h1>
      <StorageNote />
      <ClientOnly fallback={<p className="mt-8 text-muted">Đang tải…</p>}>
        <div className="mt-6">
          <ProgressDashboard />
        </div>
        <h2 className="mt-10 text-xl font-bold">Lịch sử làm bài</h2>
        <HistoryList />
      </ClientOnly>
    </main>
  );
}
