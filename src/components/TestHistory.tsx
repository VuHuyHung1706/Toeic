"use client";

import Link from "next/link";
import { useAttempts } from "@/lib/storage";
import { formatDuration } from "@/lib/toeic";
import type { Attempt } from "@/lib/types";

export function attemptLabel(a: Attempt) {
  return a.mode === "full" ? "Thi thử" : `Luyện Part ${a.parts.join(", ")}`;
}

export function AttemptRow({ a, showTest = false }: { a: Attempt; showTest?: boolean }) {
  const pct = a.total ? Math.round((a.correct / a.total) * 100) : 0;
  return (
    <Link
      href={`/tests/${a.testId}/result?attempt=${a.id}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2"
    >
      <span className="w-36 text-sm text-muted">{new Date(a.submittedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
      {showTest && <span className="w-32 font-medium">{a.testTitle}</span>}
      <span className="flex-1 text-sm">{attemptLabel(a)}</span>
      <span className="text-sm text-muted">{formatDuration(a.durationSec)}</span>
      <span className="w-28 text-right font-semibold">
        {a.mode === "full" ? `${a.totalScore} / 990` : `${a.correct}/${a.total} (${pct}%)`}
      </span>
    </Link>
  );
}

export default function TestHistory({ testId }: { testId: string }) {
  const attempts = useAttempts().filter((a) => a.testId === testId);
  if (!attempts.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Lịch sử làm đề này</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
        {attempts.map((a) => (
          <AttemptRow key={a.id} a={a} />
        ))}
      </div>
    </section>
  );
}
