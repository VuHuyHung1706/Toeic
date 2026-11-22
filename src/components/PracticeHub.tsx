"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { bankKeyStatus, latestOutcomes } from "@/lib/outcomes";
import { useAttempts, useReviews } from "@/lib/storage";
import type { BankTag } from "@/lib/types";
import SegmentedTabs from "./SegmentedTabs";

const SIZES = ["10", "20", "30", "all"] as const;

export default function PracticeHub({ index }: { index: BankTag[] }) {
  const attempts = useAttempts();
  const reviews = useReviews();
  const [size, setSize] = useState<(typeof SIZES)[number]>("20");
  const outcomes = useMemo(() => latestOutcomes(attempts, reviews), [attempts, reviews]);

  const stats = (t: BankTag) => {
    let correct = 0;
    let wrong = 0;
    for (const k of t.keys) {
      const s = bankKeyStatus(k, outcomes);
      if (s === "correct") correct++;
      else if (s === "wrong") wrong++;
    }
    return { correct, wrong, done: correct + wrong };
  };

  return (
    <>
      <div className="mt-6 flex items-center gap-2 text-sm">
        <span className="text-muted">Số câu mỗi lượt:</span>
        <SegmentedTabs label="Số câu mỗi lượt" size="sm" items={SIZES.map((n) => ({ key: n, label: n === "all" ? "Tất cả" : n }))} value={size} onChange={setSize} />
      </div>

      {([2, 5] as const).map((part) => (
        <section key={part} className="mt-8">
          <h2 className="text-xl font-bold">
            Part {part} · {part === 2 ? "Hỏi – đáp (nghe)" : "Hoàn thành câu (ngữ pháp & từ vựng)"}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {index
              .filter((t) => t.part === part && t.count > 0)
              .map((t) => {
                const s = stats(t);
                const acc = s.done ? Math.round((s.correct / s.done) * 100) : null;
                return (
                  <Link
                    key={t.tag}
                    href={`/practice/${t.part}/${t.tag}?n=${size}`}
                    className="group flex flex-col rounded-2xl border border-line bg-surface p-4 transition hover:border-primary"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold group-hover:text-primary">{t.label}</div>
                      {acc !== null && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            acc >= 75 ? "bg-success-soft text-success" : acc >= 50 ? "bg-primary-soft text-primary" : "bg-danger-soft text-danger"
                          }`}
                        >
                          {acc}% đúng
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted">
                      {t.count} câu · đã làm {s.done}
                      {s.wrong > 0 && <span className="text-danger"> · sai {s.wrong}</span>}
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full bg-primary" style={{ width: `${(s.done / t.count) * 100}%` }} />
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
      <p className="mt-8 text-xs text-muted">
        Nhãn dạng câu được gắn tự động theo quy tắc (từ đầu câu hỏi ở Part 2, các phương án ở Part 5) nên có thể lệch ở một số
        câu.
      </p>
    </>
  );
}
