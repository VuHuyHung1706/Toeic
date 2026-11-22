"use client";

import Link from "next/link";
import { useAttempts } from "@/lib/storage";
import { AttemptRow } from "./TestHistory";

export default function HistoryList() {
  const attempts = useAttempts();

  if (!attempts.length) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-line p-10 text-center text-muted">
        Chưa có bài làm nào.{" "}
        <Link href="/tests" className="text-primary hover:underline">
          Vào kho đề
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
      {attempts.map((a) => (
        <AttemptRow key={a.id} a={a} showTest />
      ))}
    </div>
  );
}
