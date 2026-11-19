import type { Metadata } from "next";
import { getTestIndex } from "@/lib/tests";
import TestBrowser from "@/components/TestBrowser";

export const metadata: Metadata = { title: "Đề thi thử" };

export default async function TestsPage() {
  const tests = await getTestIndex();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Kho đề TOEIC</h1>
      <p className="mt-2 text-muted">
        {tests.length} đề · 200 câu · 120 phút. Chọn <b>Thi thử</b> để làm full đề bấm giờ, hoặc <b>Luyện tập</b> để luyện từng
        part.
      </p>
      <TestBrowser tests={tests} />
    </main>
  );
}
