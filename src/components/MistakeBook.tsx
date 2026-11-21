"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import GroupView from "./GroupView";
import StepTransition from "./StepTransition";
import { MASTER_STREAK, REVIEW_INTERVALS, computeMistakes, groupsOfMistakes, mistakeTestIds, type MistakeItem } from "@/lib/mistakes";
import { questionKey, recordReview, useAttempts, useReviews } from "@/lib/storage";
import { PARTS } from "@/lib/toeic";
import { useTests } from "@/lib/useTests";
import type { Letter, PartNo, QuestionGroup, TestData } from "@/lib/types";
import { CardsSkeleton } from "./Skeleton";
import SegmentedTabs from "./SegmentedTabs";

type Tab = "todo" | "scheduled" | "mastered";

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: "todo", label: "Cần ôn", empty: "Không có câu nào cần ôn trong mục này 🎉" },
  { id: "scheduled", label: "Đang ghi nhớ", empty: "Chưa có câu nào đang chờ ôn lại." },
  { id: "mastered", label: "Đã thuộc", empty: "Chưa có câu nào đã thuộc." },
];

function tabOf(i: MistakeItem): Tab {
  return i.status === "wrong" || i.status === "due" ? "todo" : i.status;
}

export default function MistakeBook() {
  const attempts = useAttempts();
  const reviews = useReviews();
  const testIds = useMemo(() => mistakeTestIds(attempts, reviews), [attempts, reviews]);
  const { tests, loading, error } = useTests(testIds);
  const [includeSkipped, setIncludeSkipped] = useState(false);
  const [part, setPart] = useState<PartNo | "all">("all");
  const [tab, setTab] = useState<Tab>("todo");
  const [session, setSession] = useState<{ test: TestData; group: QuestionGroup }[] | null>(null);
  // "bây giờ" cố định cho lần mở trang, để render thuần
  const [now] = useState(() => Date.now());

  const items = useMemo(
    () => computeMistakes(attempts, reviews, tests, includeSkipped, now),
    [attempts, reviews, tests, includeSkipped, now],
  );

  if (!testIds.length) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-line p-10 text-center text-muted">
        Chưa có bài làm nào nên sổ câu sai đang trống.{" "}
        <Link href="/tests" className="text-primary hover:underline">
          Làm một đề
        </Link>{" "}
        hoặc{" "}
        <Link href="/practice" className="text-primary hover:underline">
          luyện theo dạng câu
        </Link>
        .
      </div>
    );
  }
  if (error) return <p className="mt-8 text-danger">{error}</p>;
  if (loading) return <CardsSkeleton label="Đang tải dữ liệu đề" cards={4} />;

  if (session) return <MistakeSession groups={session} onExit={() => setSession(null)} />;

  const byTab = (t: Tab) => items.filter((i) => tabOf(i) === t);
  const inTab = byTab(tab);
  const list = inTab.filter((i) => part === "all" || i.part === part);
  const countByPart = (p: PartNo) => inTab.filter((i) => i.part === p).length;
  const todo = byTab("todo");
  const dueCount = todo.filter((i) => i.status === "due").length;

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile value={todo.length - dueCount} label="Đang sai" tone="danger" />
        <Tile value={dueCount} label="Đến hạn ôn lại" tone="warn" />
        <Tile value={byTab("scheduled").length} label="Đang ghi nhớ" />
        <Tile value={byTab("mastered").length} label="Đã thuộc" tone="success" />
      </div>
      <p className="mt-2 text-xs text-muted">
        Làm đúng lại một câu → hẹn ôn sau {REVIEW_INTERVALS.join(" → ")} ngày. Đúng {MASTER_STREAK} lần liên tiếp thì coi là
        đã thuộc; sai lần nào thì quay về “cần ôn”.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SegmentedTabs
          label="Trạng thái"
          items={TABS.map((t) => ({ key: t.id, label: t.label, count: byTab(t.id).length }))}
          value={tab}
          onChange={setTab}
        />
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={includeSkipped} onChange={(e) => setIncludeSkipped(e.target.checked)} className="size-4" />
          Tính cả câu bỏ trống
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <SegmentedTabs
          label="Lọc theo part"
          size="sm"
          items={(["all", ...PARTS.map((p) => p.part)] as const).map((p) => ({
            key: p,
            label: p === "all" ? "Tất cả" : `Part ${p}`,
            count: p === "all" ? inTab.length : countByPart(p),
          }))}
          value={part}
          onChange={setPart}
        />
      </div>

      {list.length > 0 && tab !== "mastered" && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4">
          <div className="flex-1 text-sm">
            {tab === "todo" ? "Luyện lại" : "Ôn sớm"} <b>{list.length}</b> câu {part === "all" ? "" : `Part ${part} `}— hiện đáp án và
            giải thích ngay sau khi chọn.
          </div>
          <button
            onClick={() => setSession(groupsOfMistakes(list, tests))}
            className="rounded-lg bg-primary px-5 py-2 font-semibold text-on-primary hover:opacity-90"
          >
            Bắt đầu
          </button>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
        {list.length ? (
          list.map((i) => <MistakeRow key={i.key} item={i} />)
        ) : (
          <div className="p-8 text-center text-muted">{TABS.find((t) => t.id === tab)!.empty}</div>
        )}
      </div>
    </>
  );
}

function Tile({ value, label, tone }: { value: number; label: string; tone?: "danger" | "success" | "warn" }) {
  const color = { danger: "text-danger", success: "text-success", warn: "text-warn" }[tone ?? "danger"];
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className={`text-3xl font-bold ${tone ? color : ""}`}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

function MistakeRow({ item }: { item: MistakeItem }) {
  const badge =
    item.status === "wrong"
      ? ["Đang sai", "bg-danger-soft text-danger"]
      : item.status === "due"
        ? ["Đến hạn ôn", "bg-warn-soft text-warn"]
        : item.status === "scheduled"
          ? [`Ôn lại ${new Date(item.nextDue!).toLocaleDateString("vi-VN")}`, "bg-primary-soft text-primary"]
          : ["Đã thuộc", "bg-success-soft text-success"];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-0">
      <span className="w-28 font-medium">{item.testTitle.replace(" – ", " · ")}</span>
      <span className="w-20 text-sm">Câu {item.number}</span>
      <span className="w-52 text-sm text-muted">
        Part {item.part} · {PARTS[item.part - 1].name}
      </span>
      <span className="flex-1 text-sm text-muted">
        {!item.inAttempt ? "Từ luyện theo dạng" : item.lastSelected ? `Lần làm bài: chọn ${item.lastSelected}` : "Lần làm bài: bỏ trống"}{" "}
        · đáp án {item.answer} · sai{" "}
        {item.wrongCount} lần
      </span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge[1]}`}>{badge[0]}</span>
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
      <StepTransition index={index} className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <GroupView
          key={group.id}
          group={group}
          answers={local}
          onSelect={(n, l) => {
            // đoạn đã hiện đáp án thì khoá; trước đó vẫn được đổi lựa chọn
            if (allAnswered) return;
            const next = { ...local, [n]: l };
            setAnswers((a) => ({ ...a, [questionKey(test.id, n)]: l }));
            // vừa trả lời đủ cả đoạn → chấm và ghi lại kết quả cho từng câu
            if (group.questionNumbers.every((m) => next[m])) {
              for (const q of group.questions) recordReview(questionKey(test.id, q.number), next[q.number] === q.answer);
            }
          }}
          isRevealed={() => allAnswered}
          showScript={allAnswered}
          showAudio
        />
      </StepTransition>
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
