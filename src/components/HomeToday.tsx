"use client";
// Khối "Hôm nay" ở trang chủ: làm tiếp bài đang dở, câu sai cần ôn, chuỗi ngày học, điểm dự đoán.
// Đọc dữ liệu học trên trình duyệt → chỉ render ở client (bọc trong ClientOnly ở trang chủ).
// Người mới (chưa có dữ liệu gì) không thấy khối này.
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import CountUp from "./CountUp";
import { Icon, sectionOf } from "./SectionIcons";
import { buildActivity, streakOf } from "@/lib/activity";
import { computeMistakes, mistakeTestIds } from "@/lib/mistakes";
import { dayKey, listProgress, useAttempts, useDictation, useReviews, useVocabLog } from "@/lib/storage";
import { PARTS, predictScore } from "@/lib/toeic";
import { useTests } from "@/lib/useTests";

export interface HomeTest {
  id: string;
  year: number;
  number: number;
}

const testName = (t: HomeTest | undefined, id: string) => (t ? `ETS ${t.year} · Test ${t.number}` : id);

export default function HomeToday({ tests }: { tests: HomeTest[] }) {
  const attempts = useAttempts();
  const reviews = useReviews();
  const dictation = useDictation();
  const vocabLog = useVocabLog();
  // render ở client (ClientOnly) → đọc localStorage ngay khi khởi tạo được
  const [now] = useState(() => Date.now());
  const [unfinished] = useState(() => listProgress().filter((e) => tests.some((t) => t.id === e.testId)));

  const activity = useMemo(() => buildActivity(attempts, reviews, dictation, vocabLog), [attempts, reviews, dictation, vocabLog]);
  const streak = streakOf(activity, now);
  const todayCount = activity.get(dayKey(now)) ?? 0;
  const prediction = useMemo(() => predictScore(attempts, now), [attempts, now]);

  // câu sai cần ôn: cần dữ liệu các đề đã làm (tải sau, đề nào đã gỡ khỏi kho thì bỏ qua)
  const ids = useMemo(() => mistakeTestIds(attempts, reviews), [attempts, reviews]);
  const { tests: loaded, loading } = useTests(ids);
  const todo = useMemo(
    () => computeMistakes(attempts, reviews, loaded, false, now).filter((m) => m.status === "wrong" || m.status === "due"),
    [attempts, reviews, loaded, now],
  );

  if (!attempts.length && !unfinished.length && !activity.size) return null;

  const byId = new Map(tests.map((t) => [t.id, t]));
  // bài dở mới nhất; bài nào chưa có → gợi ý đề mới nhất chưa làm
  const resume = [...unfinished].sort((a, b) => b.progress.startedAt - a.progress.startedAt)[0];
  const done = new Set(attempts.map((a) => a.testId));
  const suggestion = tests.find((t) => !done.has(t.id));

  const date = new Date(now).toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" });

  return (
    <section aria-labelledby="today" className="step-fade mb-10">
      <div className="flex items-baseline justify-between gap-3">
        <h1 id="today" className="text-2xl font-bold">
          Hôm nay
        </h1>
        <span className="text-sm text-muted first-letter:uppercase">{date}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* làm tiếp / gợi ý đề */}
        <div className="flex flex-col rounded-xl border border-line bg-surface p-5 sm:col-span-3 lg:col-span-2">
          {resume ? (
            <ResumeCard entry={resume} name={testName(byId.get(resume.testId), resume.testId)} more={unfinished.length - 1} />
          ) : (
            <>
              <div className="text-sm text-muted">Không có bài đang làm dở</div>
              <div className="mt-1 text-lg font-semibold">{suggestion ? `Gợi ý: ${testName(suggestion, suggestion.id)}` : "Bạn đã làm hết các đề"}</div>
              <div className="mt-1 text-sm text-muted">{suggestion ? "Đề mới nhất bạn chưa làm." : "Thi lại một đề cũ để xem tiến bộ."}</div>
              <Link
                href={suggestion ? `/tests/${suggestion.id}` : "/tests"}
                className="mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-sm font-semibold text-primary hover:underline"
              >
                {suggestion ? "Xem đề" : "Chọn đề"} →
              </Link>
            </>
          )}
        </div>

        <StatCard href="/mistakes" icon="mistakes" label="Câu sai cần ôn">
          <div className="text-3xl font-bold">{loading ? <span className="text-muted">…</span> : <CountUp value={todo.length} />}</div>
          <div className="mt-1 text-sm text-muted">
            {loading ? "Đang tính…" : todo.length ? "câu sai hoặc đến hạn ôn lại" : "Đã ôn hết, chưa có câu nào cần ôn"}
          </div>
        </StatCard>

        <StatCard href="/history" icon="streak" label="Chuỗi ngày học" color="text-orange-500 dark:text-orange-400" tint="bg-orange-500/10">
          <div className="text-3xl font-bold">
            <CountUp value={streak} /> <span className="text-base font-medium text-muted">ngày</span>
          </div>
          <div className="mt-1 text-sm text-muted">
            {todayCount ? `Hôm nay đã học ${todayCount} lượt` : streak ? "Học hôm nay để giữ chuỗi" : "Học hôm nay để bắt đầu chuỗi"}
          </div>
        </StatCard>

        <StatCard href="/history" icon="history" label="Điểm dự đoán">
          <div className="text-3xl font-bold">
            {prediction.total != null ? <CountUp value={prediction.total} duration={1100} /> : <span className="text-muted">—</span>}
            <span className="text-base font-medium text-muted"> / 990</span>
          </div>
          <div className="mt-1 text-sm text-muted">
            {prediction.total != null ? `Từ bài làm ${prediction.windowDays} ngày gần nhất` : "Làm thêm câu nghe và đọc để có dự đoán"}
          </div>
        </StatCard>
      </div>
    </section>
  );
}

function ResumeCard({ entry, name, more }: { entry: ReturnType<typeof listProgress>[number]; name: string; more: number }) {
  const total = entry.mode === "full" ? 200 : PARTS.filter((p) => entry.parts.includes(p.part)).reduce((s, p) => s + p.count, 0);
  const answered = Object.keys(entry.progress.answers).length;
  const pct = total ? Math.min(100, (answered / total) * 100) : 0;
  const href =
    entry.mode === "full"
      ? `/tests/${entry.testId}/exam?mode=full`
      : `/tests/${entry.testId}/exam?mode=practice&parts=${entry.parts.join(",")}`;
  const minutes = Math.round(entry.progress.elapsedSec / 60);
  return (
    <>
      <div className="text-sm text-muted">Đang làm dở</div>
      <div className="mt-1 text-lg font-semibold">
        {name} <span className="font-normal text-muted">· {entry.mode === "full" ? "Thi thử" : `Luyện Part ${entry.parts.join(", ")}`}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="bar-grow h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted">
          {answered}/{total} câu{minutes ? ` · ${minutes} phút` : ""}
        </span>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
        <Link href={href} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90">
          Làm tiếp →
        </Link>
        {more > 0 && <span className="text-sm text-muted">+ {more} bài dở khác (mở lại từ trang đề)</span>}
      </div>
    </>
  );
}

function StatCard({
  href,
  icon,
  label,
  color,
  tint,
  children,
}: {
  href: string;
  icon: "mistakes" | "streak" | "history";
  label: string;
  color?: string;
  tint?: string;
  children: ReactNode;
}) {
  const s = icon === "streak" ? null : sectionOf(href);
  return (
    <Link href={href} className="group rounded-xl border border-line bg-surface p-5 transition hover:border-primary">
      <div className="flex items-center gap-2 text-sm font-medium text-muted">
        <span className={`grid size-7 place-items-center rounded-lg ${tint ?? s?.tint}`}>
          <Icon
            name={icon}
            className={`size-4 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none ${color ?? s?.color}`}
          />
        </span>
        {label}
      </div>
      <div className="mt-3">{children}</div>
    </Link>
  );
}
