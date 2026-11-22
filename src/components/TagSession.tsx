"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import GroupView from "./GroupView";
import QuestionDrawer from "./QuestionDrawer";
import StepNav from "./StepNav";
import StepTransition from "./StepTransition";
import { bankKeyStatus, latestOutcomes } from "@/lib/outcomes";
import { questionKey, recordReview, useAttempts, useReviews } from "@/lib/storage";
import type { BankItem, Letter } from "@/lib/types";
import BackLink from "./BackLink";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TagSession({ part, tag, label }: { part: number; tag: string; label: string }) {
  // ?n=10|20|30 câu mỗi lượt, ?n=all = cả dạng
  const nParam = useSearchParams().get("n");
  const n = nParam === "all" ? Infinity : Math.max(5, Math.min(50, Number(nParam) || 20));
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
  const [navOpen, setNavOpen] = useState(false);

  // ← → chuyển câu (như phòng luyện thi); → ở câu cuối = xem kết quả
  const count = state.round === round && state.items ? state.items.length : 0;
  useEffect(() => {
    if (!count || index >= count) return;
    const onKey = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName;
      if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA" || t === "AUDIO" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, count));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, index]);

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
      <BackLink href="/practice">Các dạng câu</BackLink>
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
              className="rounded-xl bg-primary px-5 py-2 font-semibold text-on-primary"
            >
              Luyện lượt mới
            </button>
            <Link href="/mistakes" className="rounded-xl border border-line px-5 py-2 font-semibold hover:bg-surface-2">
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
  const answeredCount = items.filter((x) => answers[keyOf(x)]).length;
  // ô trong bảng câu: chưa làm / đúng / sai (luyện theo dạng: mỗi mục là một câu)
  const cellCls = (x: BankItem) => {
    const sel = answers[keyOf(x)];
    if (!sel) return "border-line bg-surface text-muted hover:bg-surface-2";
    return sel === x.group.questions[0].answer ? "border-success bg-success-soft text-success" : "border-danger bg-danger-soft text-danger";
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-24">
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
      <StepTransition index={index} className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
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
      </StepTransition>

      {/* thanh điều hướng ở đáy + bảng câu (như phòng luyện thi) */}
      <StepNav
        label={`Câu ${index + 1}/${items.length}`}
        canPrev={index > 0}
        // › ở câu cuối = xem kết quả (nút "Xem kết quả" cũng có trong bảng câu)
        canNext
        onPrev={() => setIndex(index - 1)}
        onNext={() => setIndex(index + 1)}
        listOpen={navOpen}
        onToggleList={() => setNavOpen((o) => !o)}
      />
      <QuestionDrawer
        showButton={false}
        open={navOpen}
        onOpenChange={setNavOpen}
        summary={
          <>
            Đã làm <b className="text-fg">{answeredCount}</b>/{items.length}
          </>
        }
      >
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6">
          {items.map((x, i) => (
            <button
              key={keyOf(x)}
              data-current={i === index || undefined}
              title={`${x.testTitle} · câu ${x.group.questions[0].number}`}
              onClick={() => {
                setIndex(i);
                setNavOpen(false);
              }}
              className={`h-8 rounded-md border text-xs font-semibold ${cellCls(x)} ${
                i === index ? "ring-2 ring-fg/60 ring-offset-1 ring-offset-surface" : ""
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setIndex(items.length);
            setNavOpen(false);
          }}
          className="mt-4 w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90"
        >
          Xem kết quả
        </button>
      </QuestionDrawer>
    </main>
  );
}
