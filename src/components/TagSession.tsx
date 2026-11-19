"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import GroupView from "./GroupView";
import { bankKeyStatus, latestOutcomes } from "@/lib/outcomes";
import { questionKey, recordReview, useAttempts, useReviews } from "@/lib/storage";
import type { BankItem, Letter } from "@/lib/types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TagSession({ part, tag, label }: { part: number; tag: string; label: string }) {
  const n = Math.max(5, Math.min(50, Number(useSearchParams().get("n")) || 20));
  const attempts = useAttempts();
  const reviews = useReviews();
  const outcomes = useMemo(() => latestOutcomes(attempts, reviews), [attempts, reviews]);
  const outcomesRef = useRef(outcomes);
  useEffect(() => {
    outcomesRef.current = outcomes;
  }, [outcomes]);

  const [round, setRound] = useState(0);
  const [state, setState] = useState<{ round: number; items: BankItem[] | null; error?: string }>({ round: -1, items: null });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Letter>>({});

  // tải ngân hàng câu rồi chọn: câu từng sai → câu chưa làm → câu đã đúng
  useEffect(() => {
    let alive = true;
    fetch(`/api/bank/${part}/${tag}`)
      .then((r) => (r.ok ? (r.json() as Promise<BankItem[]>) : Promise.reject(new Error("Không tải được câu hỏi"))))
      .then(
        (all) => {
          if (!alive) return;
          const rank = { wrong: 0, new: 1, correct: 2 } as const;
          const scored = shuffle(all).map((it) => {
            const q = it.group.questions[0];
            return { it, r: rank[bankKeyStatus(`${it.testId}:${q.number}:${q.answer ?? ""}`, outcomesRef.current)] };
          });
          scored.sort((a, b) => a.r - b.r);
          setState({ round, items: scored.slice(0, n).map((x) => x.it) });
        },
        (e: Error) => alive && setState({ round, items: null, error: e.message }),
      );
    return () => {
      alive = false;
    };
  }, [part, tag, n, round]);

  const header = (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Link href="/practice" className="text-sm text-muted hover:text-fg">
        ← Các dạng câu
      </Link>
      <h1 className="flex-1 text-xl font-bold">
        Part {part} · {label}
      </h1>
    </div>
  );

  if (state.error) return <main className="mx-auto w-full max-w-5xl px-4 py-8">{header}<p className="text-danger">{state.error}</p></main>;
  if (state.round !== round || !state.items) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {header}
        <p className="text-muted">Đang chọn câu hỏi…</p>
      </main>
    );
  }

  const items = state.items;
  const keyOf = (it: BankItem) => questionKey(it.testId, it.group.questions[0].number);
  const done = index >= items.length;

  if (done) {
    const correct = items.filter((it) => answers[keyOf(it)] === it.group.questions[0].answer).length;
    const answered = items.filter((it) => answers[keyOf(it)]).length;
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {header}
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <div className="text-sm text-muted">Kết quả lượt luyện</div>
          <div className="mt-2 text-5xl font-bold">
            {correct}/{items.length}
          </div>
          <div className="text-muted">câu đúng{answered < items.length && ` · bỏ qua ${items.length - answered} câu`}</div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                setAnswers({});
                setIndex(0);
                setRound((r) => r + 1);
              }}
              className="rounded-lg bg-primary px-5 py-2 font-semibold text-on-primary"
            >
              Luyện lượt mới
            </button>
            <Link href="/mistakes" className="rounded-lg border border-line px-5 py-2 font-semibold hover:bg-surface-2">
              Xem sổ câu sai
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const it = items[index];
  const local: Record<number, Letter> = {};
  for (const q of it.group.questions) {
    const v = answers[questionKey(it.testId, q.number)];
    if (v) local[q.number] = v;
  }
  const answeredHere = it.group.questions.every((q) => local[q.number]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {header}
      <div className="mb-3 flex items-center gap-3 text-sm text-muted">
        <span>
          Câu {index + 1}/{items.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-primary" style={{ width: `${(index / items.length) * 100}%` }} />
        </div>
        <span>{it.testTitle}</span>
      </div>
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <GroupView
          key={`${it.testId}:${it.group.id}`}
          group={it.group}
          answers={local}
          onSelect={(num, l) => {
            const key = questionKey(it.testId, num);
            if (answers[key]) return;
            setAnswers((a) => ({ ...a, [key]: l }));
            recordReview(key, it.group.questions.find((q) => q.number === num)?.answer === l);
          }}
          isRevealed={(num) => !!local[num]}
          showScript={answeredHere}
          showAudio
        />
      </div>
      <div className="mt-6 flex justify-between">
        <button
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
          className="rounded-lg border border-line bg-surface px-4 py-2 disabled:opacity-40"
        >
          ← Trước
        </button>
        <button onClick={() => setIndex(index + 1)} className="rounded-lg bg-primary px-5 py-2 font-semibold text-on-primary">
          {index === items.length - 1 ? "Xem kết quả" : answeredHere ? "Tiếp →" : "Bỏ qua →"}
        </button>
      </div>
    </main>
  );
}
