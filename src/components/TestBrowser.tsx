"use client";
// Kho đề: lọc theo năm + thẻ đề (năm, tên đề, điểm thi thử gần nhất, hai nút Thi thử / Luyện tập).

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAttempts } from "@/lib/storage";
import { ExamIcon, PracticeIcon } from "./ActionIcons";
import type { Attempt, TestSummary } from "@/lib/types";

/** màu điểm thi thử: ≥785 xanh lá, ≥600 xanh dương, còn lại cam */
function scoreTone(s: number) {
  if (s >= 785) return "bg-success-soft text-success";
  if (s >= 600) return "bg-primary-soft text-primary";
  return "bg-warn-soft text-warn";
}

export default function TestBrowser({ tests }: { tests: TestSummary[] }) {
  const years = useMemo(() => [...new Set(tests.map((t) => t.year))].sort((a, b) => b - a), [tests]);
  const [year, setYear] = useState<number | "all">(years[0] ?? "all");
  const attempts = useAttempts();

  // bài làm theo đề, mới nhất trước
  const byTest = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    for (const a of attempts) m.set(a.testId, [...(m.get(a.testId) ?? []), a]);
    for (const list of m.values()) list.sort((a, b) => b.submittedAt - a.submittedAt);
    return m;
  }, [attempts]);

  const shown = tests.filter((t) => year === "all" || t.year === year);
  const done = tests.filter((t) => byTest.has(t.id)).length;
  const best = Math.max(0, ...attempts.map((a) => a.totalScore ?? 0));

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {/* lọc năm: nhóm nút liền khối, nút đang chọn nổi lên */}
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1" role="tablist" aria-label="Lọc theo năm">
          {(["all", ...years] as const).map((y) => (
            <button
              key={y}
              role="tab"
              aria-selected={year === y}
              onClick={() => setYear(y)}
              className={`shrink-0 rounded-xl px-4 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                year === y ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {y === "all" ? "Tất cả" : `ETS ${y}`}
              <span className="ml-1.5 text-xs opacity-70">{y === "all" ? tests.length : tests.filter((t) => t.year === y).length}</span>
            </button>
          ))}
        </div>
        {done > 0 && (
          <div className="flex gap-4 text-sm text-muted">
            <span>
              Đã làm <b className="text-fg">{done}</b>/{tests.length} đề
            </span>
            {best > 0 && (
              <span>
                Điểm cao nhất <b className="text-fg">{best}</b>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t, i) => (
          <TestCard
            key={t.id}
            test={t}
            attempts={byTest.get(t.id) ?? []}
            delay={Math.min(i, 8) * 40}
          />
        ))}
      </div>
    </>
  );
}

function TestCard({
  test: t,
  attempts,
  delay,
}: {
  test: TestSummary;
  attempts: Attempt[];
  delay: number;
}) {
  const lastFull = attempts.find((a) => a.mode === "full");

  return (
    <div
      className="step-fade relative flex flex-col rounded-2xl border border-line bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 motion-reduce:hover:translate-y-0"
      // "backwards": giữ trạng thái đầu trong lúc chờ; sau khi chạy xong không khoá transform (để hiệu ứng rê chuột vẫn chạy)
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-wide text-muted uppercase">ETS {t.year}</div>
          <Link href={`/tests/${t.id}`} className="text-xl leading-tight font-bold hover:text-primary">
            Test {t.number}
          </Link>
          <div className="mt-1 text-sm text-muted">
            {t.questionCount} câu · {t.durationMinutes} phút
          </div>
        </div>
        {lastFull?.totalScore != null ? (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${scoreTone(lastFull.totalScore)}`} title="Điểm thi thử gần nhất">
            {lastFull.totalScore}
            <span className="font-medium opacity-70"> / 990</span>
          </span>
        ) : attempts.length ? (
          <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">Đang luyện</span>
        ) : (
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">Chưa làm</span>
        )}
      </div>

      <div className="mt-auto flex gap-2 pt-4">
        <Link
          href={`/tests/${t.id}/exam?mode=full`}
          className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary shadow-sm shadow-primary/20 transition hover:opacity-90"
        >
          <ExamIcon />
          Thi thử
        </Link>
        <Link
          href={`/tests/${t.id}`}
          className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold transition hover:border-violet-400/60 hover:bg-violet-500/5"
        >
          <PracticeIcon className="text-violet-500 dark:text-violet-400" />
          Luyện tập
        </Link>
      </div>
    </div>
  );
}
