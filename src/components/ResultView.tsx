"use client";

import Link from "next/link";
import CountUp from "./CountUp";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import GroupView from "./GroupView";
import QuestionDrawer from "./QuestionDrawer";
import StepNav from "./StepNav";
import StepTransition from "./StepTransition";
import QuestionNav, { type CellState } from "./QuestionNav";
import { useAttempts } from "@/lib/storage";
import { formatDuration, groupsForParts, partInfo } from "@/lib/toeic";
import type { PartNo, TestData } from "@/lib/types";
import SegmentedTabs from "./SegmentedTabs";

type Filter = "all" | "wrong" | "skipped";

export default function ResultView({ test }: { test: TestData }) {
  const id = useSearchParams().get("attempt");
  const attempt = useAttempts().find((a) => a.id === id && a.testId === test.id);
  const [filter, setFilter] = useState<Filter>("all");
  const [groupIndex, setGroupIndex] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const groups = useMemo(() => (attempt ? groupsForParts(test, attempt.parts) : []), [test, attempt]);
  const answerOf = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const g of groups) for (const q of g.questions) m.set(q.number, q.answer);
    return m;
  }, [groups]);

  if (!attempt) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-muted">Không tìm thấy bài làm này trên trình duyệt.</p>
        <Link href={`/tests/${test.id}`} className="mt-4 inline-block text-primary hover:underline">
          Về trang đề
        </Link>
      </main>
    );
  }

  const cellState = (n: number): CellState => {
    const a = attempt.answers[n];
    if (!a) return "skipped";
    return a === answerOf.get(n) ? "correct" : "wrong";
  };
  const matches = (gi: number) =>
    filter === "all" || groups[gi].questionNumbers.some((n) => cellState(n) === (filter === "wrong" ? "wrong" : "skipped"));
  const visible = groups.map((_, gi) => gi).filter(matches);
  const wrong = [...answerOf.keys()].filter((n) => cellState(n) === "wrong").length;
  const skipped = [...answerOf.keys()].filter((n) => cellState(n) === "skipped").length;
  const current = groupIndex !== null ? groups[groupIndex] : null;
  /** chuyển nhóm câu và cuộn lên đầu phần xem lại */
  const showGroup = (gi: number) => {
    setGroupIndex(gi);
    requestAnimationFrame(() => document.getElementById("review")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const pos = groupIndex !== null ? visible.indexOf(groupIndex) : -1;

  const retryHref =
    attempt.mode === "full"
      ? `/tests/${test.id}/exam?mode=full`
      : `/tests/${test.id}/exam?mode=practice&parts=${attempt.parts.join(",")}`;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <Link href={`/tests/${test.id}`} className="text-sm text-muted hover:text-fg">
        ← {test.title}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Kết quả {attempt.mode === "full" ? "thi thử" : "luyện tập"}</h1>
      <p className="text-sm text-muted">
        {new Date(attempt.submittedAt).toLocaleString("vi-VN")} · thời gian làm {formatDuration(attempt.durationSec)}
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-line bg-surface p-6">
          {attempt.mode === "full" ? (
            <>
              <div className="text-sm text-muted">Điểm ước tính</div>
              <div className="text-5xl font-bold">
                <CountUp value={attempt.totalScore ?? 0} duration={1200} />
                <span className="text-xl font-medium text-muted"> / 990</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <ScoreBox label="Listening" score={attempt.listeningScore!} correct={attempt.listeningCorrect} />
                <ScoreBox label="Reading" score={attempt.readingScore!} correct={attempt.readingCorrect} />
              </div>
              <p className="mt-3 text-xs text-muted">Quy đổi theo bảng ước lượng phổ biến, không phải điểm ETS chính thức.</p>
            </>
          ) : (
            <>
              <div className="text-sm text-muted">Số câu đúng</div>
              <div className="text-5xl font-bold">
                <CountUp value={attempt.correct} />
                <span className="text-xl font-medium text-muted"> / {attempt.total}</span>
              </div>
              <div className="mt-1 text-lg font-semibold text-primary">
                <CountUp value={attempt.total ? Math.round((attempt.correct / attempt.total) * 100) : 0} />%
              </div>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-success-soft px-3 py-1 text-success">Đúng {attempt.correct}</span>
            <span className="rounded-full bg-danger-soft px-3 py-1 text-danger">Sai {wrong}</span>
            <span className="rounded-full bg-warn-soft px-3 py-1 text-warn">Bỏ trống {skipped}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={retryHref} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
              Làm lại
            </Link>
            {wrong + skipped > 0 && (
              <Link href="/mistakes" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2">
                Ôn câu sai
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="mb-3 font-semibold">Theo từng part</div>
          <div className="space-y-3">
            {(Object.keys(attempt.byPart) as unknown as PartNo[]).map((p, i) => {
              const r = attempt.byPart[p]!;
              const pct = r.total ? (r.correct / r.total) * 100 : 0;
              return (
                <div key={p}>
                  <div className="flex justify-between text-sm">
                    <span>
                      Part {p} · <span className="text-muted">{partInfo(Number(p) as PartNo).name}</span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {r.correct}/{r.total}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                    {/* chạy lần lượt từng part */}
                    <div
                      className={`bar-grow h-full rounded-full ${pct >= 75 ? "bg-success" : pct >= 50 ? "bg-primary" : "bg-danger"}`}
                      style={{ width: `${pct}%`, animationDelay: `${150 + i * 90}ms` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="review" className="mt-8 scroll-mt-20 pb-20">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-lg font-semibold">Xem lại đáp án</h2>
            <SegmentedTabs
              label="Lọc câu"
              size="sm"
              items={[
                { key: "all" as const, label: "Tất cả" },
                { key: "wrong" as const, label: "Câu sai", count: wrong },
                { key: "skipped" as const, label: "Bỏ trống", count: skipped },
              ]}
              value={filter}
              onChange={(f) => {
                setFilter(f);
                setGroupIndex(null);
              }}
            />
          </div>

          {current ? (
            <>
              <StepTransition index={groupIndex ?? -1}>
              <GroupView
                key={current.id}
                group={current}
                answers={attempt.answers}
                isRevealed={() => true}
                showScript
                showAudio
              />
              </StepTransition>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
              {visible.length ? (
                <>
                  Bấm <b>Câu hỏi</b> ở góc dưới bên phải để chọn câu, hoặc nút <b>›</b> để xem lần lượt.
                  <div>
                    <button onClick={() => setGroupIndex(visible[0])} className="mt-3 text-primary hover:underline">
                      Bắt đầu từ câu đầu tiên →
                    </button>
                  </div>
                </>
              ) : (
                "Không có câu nào trong mục này."
              )}
            </div>
          )}
        </div>
      </section>

      {/* thanh điều hướng dính đáy: đi theo bộ lọc đang chọn (tất cả / câu sai / bỏ trống) */}
      <StepNav
        label={
          pos >= 0
            ? `Câu ${visible.slice(0, pos).reduce((n, gi) => n + groups[gi].questions.length, 0) + 1}/${visible.reduce((n, gi) => n + groups[gi].questions.length, 0)}`
            : `${visible.reduce((n, gi) => n + groups[gi].questions.length, 0)} câu`
        }
        canPrev={pos > 0}
        canNext={visible.length > 0 && pos < visible.length - 1}
        onPrev={() => showGroup(visible[pos - 1])}
        onNext={() => showGroup(visible[pos + 1])}
        listOpen={navOpen}
        onToggleList={() => setNavOpen((o) => !o)}
      />

      {/* bảng số câu: mở bằng nút "Câu hỏi" trên thanh điều hướng */}
      <QuestionDrawer
        showButton={false}
        open={navOpen}
        onOpenChange={setNavOpen}
        summary={
          <>
            Sai <b className="text-danger">{wrong}</b> · Bỏ trống <b className="text-warn">{skipped}</b>
          </>
        }
      >
        <QuestionNav
          groups={groups}
          currentGroup={groupIndex ?? -1}
          cellState={cellState}
          onJump={(gi, n) => {
            setGroupIndex(gi);
            setNavOpen(false);
            requestAnimationFrame(() => document.getElementById(`q-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
          }}
        />
      </QuestionDrawer>
    </main>
  );
}

function ScoreBox({ label, score, correct }: { label: string; score: number; correct: number }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-bold">
        <CountUp value={score} duration={1100} delay={150} />
        <span className="text-sm font-medium text-muted"> / 495</span>
      </div>
      <div className="text-xs text-muted">{correct}/100 câu đúng</div>
    </div>
  );
}
