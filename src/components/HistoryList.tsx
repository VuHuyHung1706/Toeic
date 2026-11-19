"use client";

import Link from "next/link";
import { useAttempts } from "@/lib/storage";
import { AttemptRow } from "./TestHistory";

export default function HistoryList() {
  const attempts = useAttempts();
  const fulls = attempts.filter((a) => a.mode === "full");
  const best = fulls.reduce((m, a) => Math.max(m, a.totalScore ?? 0), 0);
  const avg = fulls.length ? Math.round(fulls.reduce((s, a) => s + (a.totalScore ?? 0), 0) / fulls.length) : 0;

  if (!attempts.length) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-line p-10 text-center text-muted">
        Chưa có bài làm nào.{" "}
        <Link href="/tests" className="text-primary hover:underline">
          Vào kho đề
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          ["Số bài đã làm", attempts.length],
          ["Điểm thi thử cao nhất", fulls.length ? best : "—"],
          ["Điểm thi thử trung bình", fulls.length ? avg : "—"],
        ].map(([label, v]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-4">
            <div className="text-2xl font-bold">{v}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
        {attempts.map((a) => (
          <AttemptRow key={a.id} a={a} showTest />
        ))}
      </div>
    </>
  );
}
