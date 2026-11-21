"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAttempts } from "@/lib/storage";
import { ExamIcon, PracticeIcon } from "./ActionIcons";
import type { Attempt, TestSummary } from "@/lib/types";

export default function TestBrowser({ tests }: { tests: TestSummary[] }) {
  const years = useMemo(() => [...new Set(tests.map((t) => t.year))].sort((a, b) => b - a), [tests]);
  const [year, setYear] = useState<number | "all">(years[0] ?? "all");
  const attempts = useAttempts();

  const latestByTest = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    for (const a of attempts) m.set(a.testId, [...(m.get(a.testId) ?? []), a]);
    return m;
  }, [attempts]);

  const shown = tests.filter((t) => year === "all" || t.year === year);

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Lọc theo năm">
        {(["all", ...years] as const).map((y) => (
          <button
            key={y}
            role="tab"
            aria-selected={year === y}
            onClick={() => setYear(y)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              year === y ? "border-primary bg-primary text-on-primary" : "border-line bg-surface hover:bg-surface-2"
            }`}
          >
            {y === "all" ? "Tất cả" : `ETS ${y}`}
            <span className="ml-1.5 opacity-70">{y === "all" ? tests.length : tests.filter((t) => t.year === y).length}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => {
          const list = latestByTest.get(t.id) ?? [];
          const lastFull = list.find((a) => a.mode === "full");
          return (
            <div key={t.id} className="flex flex-col rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase text-muted">ETS {t.year}</div>
                  <Link href={`/tests/${t.id}`} className="text-lg font-semibold hover:text-primary">
                    Test {t.number}
                  </Link>
                </div>
                {lastFull ? (
                  <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                    {lastFull.totalScore} / 990
                  </span>
                ) : list.length ? (
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                    Đã luyện {list.length} lần
                  </span>
                ) : (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">Chưa làm</span>
                )}
              </div>
              <div className="mt-2 text-sm text-muted">
                {t.questionCount} câu · {t.durationMinutes} phút
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/tests/${t.id}/exam?mode=full`}
                  className="group flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:opacity-90"
                >
                  <ExamIcon />
                  Thi thử
                </Link>
                <Link
                  href={`/tests/${t.id}`}
                  className="group flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2"
                >
                  <PracticeIcon className="text-violet-500 dark:text-violet-400" />
                  Luyện tập
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
