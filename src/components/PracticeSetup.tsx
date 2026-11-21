"use client";

import Link from "next/link";
import { useState } from "react";
import { PARTS } from "@/lib/toeic";
import type { PartNo } from "@/lib/types";
import { PracticeIcon } from "./ActionIcons";

const TIME_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 75];

export default function PracticeSetup({ testId, partCounts }: { testId: string; partCounts: { part: PartNo; count: number }[] }) {
  const [parts, setParts] = useState<PartNo[]>([1]);
  const [time, setTime] = useState(0);
  const [instant, setInstant] = useState(true);

  const toggle = (p: PartNo) =>
    setParts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p].sort() as PartNo[]));

  const total = partCounts.filter((p) => parts.includes(p.part)).reduce((s, p) => s + p.count, 0);
  const href = `/tests/${testId}/exam?mode=practice&parts=${parts.join(",")}&time=${time}&instant=${instant ? 1 : 0}`;

  return (
    <section className="rounded-xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">Luyện tập theo part</h2>
      <p className="mt-1 text-sm text-muted">Chọn một hoặc nhiều part. Audio được nghe lại, chỉnh tốc độ tuỳ ý.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {partCounts.map(({ part, count }) => {
          const info = PARTS[part - 1];
          const on = parts.includes(part);
          return (
            <label
              key={part}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                on ? "border-primary bg-primary-soft" : "border-line hover:bg-surface-2"
              }`}
            >
              <input type="checkbox" checked={on} onChange={() => toggle(part)} className="size-4 accent-[var(--primary)]" />
              <span className="flex-1">
                <span className="font-medium">Part {part}</span> <span className="text-sm text-muted">· {info.name}</span>
              </span>
              <span className="text-xs text-muted">{count} câu</span>
            </label>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button className="text-primary hover:underline" onClick={() => setParts([1, 2, 3, 4])}>
          Chọn Listening
        </button>
        <span className="text-line">|</span>
        <button className="text-primary hover:underline" onClick={() => setParts([5, 6, 7])}>
          Chọn Reading
        </button>
        <span className="text-line">|</span>
        <button className="text-primary hover:underline" onClick={() => setParts([1, 2, 3, 4, 5, 6, 7])}>
          Chọn tất cả
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <label className="flex items-center gap-2">
          Giới hạn thời gian
          <select
            value={time}
            onChange={(e) => setTime(Number(e.target.value))}
            className="rounded-md border border-line bg-surface px-2 py-1"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === 0 ? "Không giới hạn" : `${t} phút`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} className="size-4" />
          Hiện đáp án ngay khi chọn
        </label>
      </div>

      <Link
        href={href}
        aria-disabled={!parts.length}
        className={`group mt-5 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold ${
          parts.length ? "bg-primary text-on-primary hover:opacity-90" : "pointer-events-none bg-surface-2 text-muted"
        }`}
      >
        <PracticeIcon />
        Luyện {total} câu
      </Link>
    </section>
  );
}
