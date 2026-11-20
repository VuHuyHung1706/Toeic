import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTest, getTestIndex, getVocab } from "@/lib/tests";
import PracticeSetup from "@/components/PracticeSetup";
import TestHistory from "@/components/TestHistory";
import { DetailSkeleton } from "@/components/Skeleton";

export async function generateStaticParams() {
  return (await getTestIndex()).map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/tests/[id]">): Promise<Metadata> {
  const test = await getTest((await params).id);
  return { title: test ? `${test.title}` : "Không tìm thấy đề" };
}

export default function TestDetailPage({ params }: PageProps<"/tests/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton label="Đang tải đề" />}>
      <TestDetail params={params} />
    </Suspense>
  );
}

async function TestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [test, vocab] = await Promise.all([getTest(id), getVocab()]);
  if (!test) notFound();
  const vocabCount = vocab.filter((v) => v.tests[test.id] && !v.basic).length;

  const partCounts = test.parts.map((p) => ({
    part: p.part,
    count: p.groups.reduce((s, g) => s + g.questions.length, 0),
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link href="/tests" className="text-sm text-muted hover:text-fg">
        ← Kho đề
      </Link>
      <h1 className="mt-2 text-3xl font-bold">
        ETS {test.year} · Test {test.number}
      </h1>
      <p className="mt-1 text-muted">
        {test.questionCount} câu · {test.durationMinutes} phút · Listening 100 câu, Reading 100 câu
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Thi thử full đề</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            <li>• 200 câu, đồng hồ 120 phút, tự nộp khi hết giờ</li>
            <li>• Giao diện giống máy thi TOEIC trên máy tính (IIG)</li>
            <li>• Listening: audio phát liền một lần, màn hình tự chuyển theo câu đang đọc; hết audio tự sang Reading</li>
            <li>• Quy đổi điểm ước tính thang 990 sau khi nộp</li>
            <li>• Bài làm được lưu tự động, tải lại trang không mất</li>
          </ul>
          <Link
            href={`/tests/${test.id}/exam?mode=full`}
            className={`mt-5 inline-block rounded-lg px-5 py-2.5 font-semibold ${
              test.availability.fullTest
                ? "bg-primary text-on-primary hover:opacity-90"
                : "pointer-events-none bg-surface-2 text-muted"
            }`}
            aria-disabled={!test.availability.fullTest}
          >
            Bắt đầu thi thử
          </Link>
          {!test.availability.fullTest && <p className="mt-2 text-sm text-danger">Đề này thiếu audio full nên chưa thi thử được.</p>}
        </section>

        <PracticeSetup testId={test.id} partCounts={partCounts} />
      </div>

      {vocabCount > 0 && (
        <Link
          href={`/vocabulary?test=${test.id}`}
          className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 transition hover:border-primary"
        >
          <div>
            <div className="font-semibold">Từ vựng của đề này</div>
            <div className="text-sm text-muted">
              {vocabCount} từ (phần nghe và phần đọc), kèm các dạng khác của từ, học bằng thẻ ghi nhớ
            </div>
          </div>
          <span className="shrink-0 font-semibold text-primary">Học từ vựng →</span>
        </Link>
      )}

      <TestHistory testId={test.id} />
    </main>
  );
}
