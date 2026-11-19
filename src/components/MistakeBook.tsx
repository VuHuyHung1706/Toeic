"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import GroupView from "./GroupView";
import { computeMistakes, groupsOfMistakes, type MistakeItem } from "@/lib/mistakes";
import { questionKey, recordReview, useAttempts, useReviews } from "@/lib/storage";
import { PARTS } from "@/lib/toeic";
import { useTests } from "@/lib/useTests";
import type { Letter, PartNo, QuestionGroup, TestData } from "@/lib/types";

type Tab = "active" | "fixed";

export default function MistakeBook() {
  const attempts = useAttempts();
  const reviews = useReviews();
  const testIds = useMemo(() => [...new Set(attempts.map((a) => a.testId))], [attempts]);
  const { tests, loading, error } = useTests(testIds);
  const [includeSkipped, setIncludeSkipped] = useState(false);
  const [part, setPart] = useState<PartNo | "all">("all");
  const [tab, setTab] = useState<Tab>("active");
  const [session, setSession] = useState<{ test: TestData; group: QuestionGroup }[] | null>(null);

  const items = useMemo(
    () => computeMistakes(attempts, reviews, tests, includeSkipped),
    [attempts, reviews, tests, includeSkipped],
  );

  if (!attempts.length) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-line p-10 text-center text-muted">
        Chưa có bài làm nào nên sổ câu sai đang trống.{" "}
        <Link href="/tests" className="text-primary hover:underline">
          Làm một đề
        </Link>
      </div>
    );
  }
  if (error) return <p className="mt-8 text-danger">{error}</p>;
  if (loading) return <p className="mt-8 text-muted">Đang tải dữ liệu đề…</p>;

  if (session) return <MistakeSession groups={session} onExit={() => setSession(null)} />;

  const active = items.filter((i) => i.active);
  const fixed = items.filter((i) => !i.active);
  const list = (tab === "active" ? active : fixed).filter((i) => part === "all" || i.part === part);
  const countByPart = (p: PartNo) => (tab === "active" ? active : fixed).filter((i) => i.part === p).length;

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Tile value={active.length} label="Câu cần ôn" tone="danger" />
        <Tile value={fixed.length} label="Đã khắc phục" tone="success" />
        <Tile value={new Set(active.map((i) => i.testId)).size} label="Đề có câu cần ôn" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(
          [
            ["active", `Cần ôn (${active.length})`],
            ["fixed", `Đã khắc phục (${fixed.length})`],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t ? "bg-fg text-bg" : "bg-surface text-muted hover:text-fg"}`}
          >
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={includeSkipped} onChange={(e) => setIncludeSkipped(e.target.checked)} className="size-4" />
          Tính cả câu bỏ trống
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", ...PARTS.map((p) => p.part)] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPart(p)}
            className={`rounded-full border px-3 py-1 text-sm ${part === p ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface"}`}
          >
            {p === "all" ? "Tất cả" : `Part ${p}`}
            <span className="ml-1 opacity-60">{p === "all" ? list.length : countByPart(p)}</span>
          </button>
        ))}
      </div>

      {tab === "active" && list.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4">
          <div className="flex-1 text-sm">
            Luyện lại <b>{list.length}</b> câu {part === "all" ? "" : `Part ${part} `}— hiện đáp án và giải thích ngay sau khi chọn.
          </div>
          <button
            onClick={() => setSession(groupsOfMistakes(list, tests))}
            className="rounded-lg bg-primary px-5 py-2 font-semibold text-on-primary hover:opacity-90"
          >
            Bắt đầu luyện lại
          </button>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
        {list.length ? (
          list.map((i) => <MistakeRow key={i.key} item={i} />)
        ) : (
          <div className="p-8 text-center text-muted">
            {tab === "active" ? "Không có câu nào cần ôn trong mục này 🎉" : "Chưa có câu nào được khắc phục."}
          </div>
        )}
      </div>
    </>
  );
}

function Tile({ value, label, tone }: { value: number; label: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className={`text-3xl font-bold ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : ""}`}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

function MistakeRow({ item }: { item: MistakeItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-0">
      <span className="w-28 font-medium">{item.testTitle.replace(" – ", " · ")}</span>
      <span className="w-20 text-sm">Câu {item.number}</span>
      <span className="w-52 text-sm text-muted">
        Part {item.part} · {PARTS[item.part - 1].name}
      </span>
      <span className="flex-1 text-sm text-muted">
        {item.lastSelected ? `Chọn ${item.lastSelected}` : "Bỏ trống"} · đáp án {item.answer}
      </span>
      <span className="text-sm text-muted">Sai {item.wrongCount} lần</span>
      <span className="w-24 text-right text-xs text-muted">{new Date(item.lastAt).toLocaleDateString("vi-VN")}</span>
    </div>
  );
}

function MistakeSession({ groups, onExit }: { groups: { test: TestData; group: QuestionGroup }[]; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  // câu trả lời trong phiên này, theo khoá "testId:số câu"
  const [answers, setAnswers] = useState<Record<string, Letter>>({});
  const done = index >= groups.length;

  const results = Object.entries(answers);
  const correct = results.filter(([k, l]) => {
    const [testId, n] = [k.slice(0, k.lastIndexOf(":")), Number(k.slice(k.lastIndexOf(":") + 1))];
    const g = groups.find((x) => x.test.id === testId && x.group.questionNumbers.includes(n));
    return g?.group.questions.find((q) => q.number === n)?.answer === l;
  }).length;

  if (done) {
    return (
      <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="text-sm text-muted">Hoàn thành phiên luyện lại</div>
        <div className="mt-2 text-4xl font-bold">
          {correct}/{results.length}
        </div>
        <div className="text-muted">câu trả lời đúng</div>
        <button onClick={onExit} className="mt-6 rounded-lg bg-primary px-5 py-2 font-semibold text-on-primary">
          Về sổ câu sai
        </button>
      </div>
    );
  }

  const { test, group } = groups[index];
  const local: Record<number, Letter> = {};
  for (const n of group.questionNumbers) {
    const v = answers[questionKey(test.id, n)];
    if (v) local[n] = v;
  }
  const allAnswered = group.questionNumbers.every((n) => local[n]);

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={onExit} className="text-sm text-muted hover:text-fg">
          ← Thoát
        </button>
        <div className="flex-1 text-sm text-muted">
          {test.title} · nhóm {index + 1}/{groups.length}
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-primary" style={{ width: `${(index / groups.length) * 100}%` }} />
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <GroupView
          key={group.id}
          group={group}
          answers={local}
          onSelect={(n, l) => {
            const key = questionKey(test.id, n);
            if (answers[key]) return;
            setAnswers((a) => ({ ...a, [key]: l }));
            recordReview(key, group.questions.find((q) => q.number === n)?.answer === l);
          }}
          isRevealed={(n) => !!local[n]}
          showScript={allAnswered}
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
          {index === groups.length - 1 ? "Kết thúc" : "Tiếp →"}
        </button>
      </div>
    </div>
  );
}
