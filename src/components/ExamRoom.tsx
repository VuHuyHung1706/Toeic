"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AudioPlayer from "./AudioPlayer";
import CbtRoom from "./CbtRoom";
import GroupView from "./GroupView";
import QuestionDrawer from "./QuestionDrawer";
import StepNav from "./StepNav";
import StepTransition from "./StepTransition";
import QuestionNav, { answeredCount, type CellState } from "./QuestionNav";
import { directionsPartAt, hasAudioTimeline, listeningIndexAt } from "@/lib/cbt";
import { clearProgress, loadProgress, progressKey, saveAttempt, saveProgress, type Progress } from "@/lib/storage";
import { formatDuration, gradeAttempt, groupsForParts, mediaUrl, parsePartsParam } from "@/lib/toeic";
import type { ExamMode, Letter, PartNo, TestData } from "@/lib/types";

const ALL_PARTS: PartNo[] = [1, 2, 3, 4, 5, 6, 7];

export default function ExamRoom({ test }: { test: TestData }) {
  const sp = useSearchParams();
  const mode: ExamMode = sp.get("mode") === "practice" ? "practice" : "full";
  const parts = mode === "full" ? ALL_PARTS : parsePartsParam(sp.get("parts"));
  const effectiveParts = parts.length ? parts : ALL_PARTS;
  const timeLimitSec = mode === "full" ? test.durationMinutes * 60 : Math.max(0, Number(sp.get("time") ?? 0)) * 60;
  const instant = mode === "practice" && sp.get("instant") !== "0";

  // ExamRoom chỉ render lại khi URL đổi, nên không cần memo
  const groups = groupsForParts(test, effectiveParts);
  const storeKey = progressKey(test.id, mode, effectiveParts);

  return (
    <ExamSession
      key={storeKey}
      test={test}
      mode={mode}
      parts={effectiveParts}
      groups={groups}
      storeKey={storeKey}
      timeLimitSec={timeLimitSec}
      instant={instant}
    />
  );
}

function ExamSession({
  test,
  mode,
  parts,
  groups,
  storeKey,
  timeLimitSec,
  instant,
}: {
  test: TestData;
  mode: ExamMode;
  parts: PartNo[];
  groups: ReturnType<typeof groupsForParts>;
  storeKey: string;
  timeLimitSec: number;
  instant: boolean;
}) {
  const router = useRouter();
  const [saved] = useState<Progress | null>(() => loadProgress(storeKey));
  const [phase, setPhase] = useState<"intro" | "running" | "submitting">(saved || mode === "full" ? "intro" : "running");
  const [answers, setAnswers] = useState<Record<number, Letter>>(() => (saved?.answers as Record<number, Letter>) ?? {});
  const [flagged, setFlagged] = useState<Set<number>>(() => new Set(saved?.flagged ?? []));
  const [elapsed, setElapsed] = useState(saved?.elapsedSec ?? 0);
  const [groupIndex, setGroupIndex] = useState(Math.min(saved?.groupIndex ?? 0, groups.length - 1));
  const [startedAt] = useState(() => saved?.startedAt ?? Date.now());
  const [confirming, setConfirming] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioState, setAudioState] = useState({ t: saved?.audioTime ?? 0, d: 0, ended: false });
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioTimeRef = useRef(saved?.audioTime ?? 0);
  const mainRef = useRef<HTMLDivElement>(null);

  const total = groups.reduce((s, g) => s + g.questions.length, 0);
  const answered = answeredCount(answers, groups);
  const remaining = timeLimitSec ? timeLimitSec - elapsed : null;
  const fullAudioUrl = mode === "full" ? mediaUrl(test.fullAudio?.src) : null;

  // ---------------- thi thật (giao diện máy thi) ----------------
  // Có mốc thời gian từng nhóm câu trong audio cả đề → phần nghe tự chuyển câu theo audio, không chuyển tay được;
  // hết audio → sang Reading (làm tự do, không quay lại phần nghe). Không có mốc → chuyển câu tự do như cũ.
  const cbt = mode === "full";
  const listening = groups.filter((g) => g.part <= 4);
  const firstReading = groups.findIndex((g) => g.part >= 5);
  const readingStart = firstReading < 0 ? groups.length : firstReading;
  const synced = cbt && hasAudioTimeline(groups);

  const answerOf = useMemo(() => {
    const m = new Map<number, Letter | null>();
    for (const g of groups) for (const q of g.questions) m.set(q.number, q.answer);
    return m;
  }, [groups]);
  // số câu → các câu cùng đoạn (Part 3/4/6/7: 2–5 câu; các part khác: chính nó)
  const siblingsOf = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const g of groups) for (const n of g.questionNumbers) m.set(n, g.questionNumbers);
    return m;
  }, [groups]);

  // ---------------- nộp bài ----------------
  // elapsedRef luôn giữ số giây mới nhất (đồng hồ chạy ngoài vòng render)
  const elapsedRef = useRef(elapsed);
  const submittedRef = useRef(false);
  const submit = useCallback(() => {
    if (submittedRef.current) return; // chống nộp hai lần (hết giờ + bấm nút cùng lúc, StrictMode…)
    submittedRef.current = true;
    setPhase("submitting");
    audioRef.current?.pause();
    const attempt = gradeAttempt({ test, mode, parts, answers, startedAt, durationSec: elapsedRef.current });
    saveAttempt(attempt);
    clearProgress(storeKey);
    router.replace(`/tests/${test.id}/result?attempt=${attempt.id}`);
  }, [test, mode, parts, answers, startedAt, storeKey, router]);

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // ---------------- đồng hồ ----------------
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      // tăng bằng ref rồi mới đặt state: hàm cập nhật state phải thuần (React có thể gọi 2 lần)
      const next = elapsedRef.current + 1;
      elapsedRef.current = next;
      setElapsed(next);
      if (timeLimitSec && next >= timeLimitSec) submitRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, [phase, timeLimitSec]);

  // ---------------- tự lưu tiến độ ----------------
  useEffect(() => {
    if (phase !== "running") return;
    saveProgress(storeKey, {
      answers,
      flagged: [...flagged],
      elapsedSec: elapsed,
      groupIndex,
      audioTime: audioTimeRef.current,
      startedAt,
    });
  }, [phase, storeKey, answers, flagged, elapsed, groupIndex, startedAt]);

  // cảnh báo khi rời trang giữa chừng
  useEffect(() => {
    if (phase !== "running") return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [phase]);

  // ---------------- chế độ tập trung ----------------
  // đang làm bài: ẩn menu trang web (chỉ trong phòng thi; màn giới thiệu và các trang khác vẫn có menu)
  useEffect(() => {
    if (phase === "intro") return;
    document.documentElement.dataset.exam = "1";
    return () => {
      delete document.documentElement.dataset.exam;
    };
  }, [phase]);

  // chiều cao thanh thi (đổi theo màn hình / có thanh audio) → vị trí dính của bài đọc và bảng câu hỏi
  const barRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(96);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarH(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // ---------------- điều hướng ----------------
  const goTo = useCallback(
    (gi: number, n?: number) => {
      const idx = Math.max(0, Math.min(groups.length - 1, gi));
      setGroupIndex(idx);
      setNavOpen(false);
      requestAnimationFrame(() => {
        if (n) document.getElementById(`q-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        else mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [groups.length],
  );

  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // không bắt phím khi đang ở ô nhập hoặc trình phát audio (← → của audio dùng để tua)
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "AUDIO" || e.metaKey || e.ctrlKey || e.altKey) return;
      // thi thật: phần nghe tự chạy theo audio, Reading không quay lại phần nghe
      const ok = (gi: number) => !synced || (groupIndex >= readingStart && gi >= readingStart);
      if (e.key === "ArrowRight" && ok(groupIndex + 1)) goTo(groupIndex + 1);
      if (e.key === "ArrowLeft" && ok(groupIndex - 1)) goTo(groupIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, groupIndex, goTo, synced, readingStart]);

  // ---------------- audio full đề ----------------
  const startAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    if (Math.abs(a.currentTime - audioTimeRef.current) > 1) a.currentTime = audioTimeRef.current;
    a.play().then(
      () => setAudioBlocked(false),
      () => setAudioBlocked(true),
    );
  }, [volume]);

  const begin = (fresh: boolean) => {
    if (fresh) {
      clearProgress(storeKey);
      setAnswers({});
      setFlagged(new Set());
      setElapsed(0);
      elapsedRef.current = 0;
      setGroupIndex(0);
      audioTimeRef.current = 0;
      setAudioState({ t: 0, d: 0, ended: false });
    }
    setPhase("running");
    // phải gọi play() trong chính sự kiện click để trình duyệt cho phép phát
    // (thi thật đã sang Reading thì không phát lại phần nghe)
    if (fullAudioUrl && !(synced && !fresh && groupIndex >= readingStart)) startAudio();
  };

  const select = (n: number, l: Letter) => {
    setAnswers((a) => ({ ...a, [n]: l }));
  };
  const setFlags = (numbers: number[], on: boolean) =>
    setFlagged((s) => {
      const next = new Set(s);
      for (const n of numbers) {
        if (on) next.add(n);
        else next.delete(n);
      }
      return next;
    });
  const toggleFlag = (n: number) =>
    setFlagged((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  // Hiện đáp án ngay: chỉ khi đã trả lời hết các câu của cả đoạn, để không lộ đáp án câu đang làm dở
  const isRevealed = (n: number) => instant && (siblingsOf.get(n) ?? [n]).every((m) => answers[m]);
  const cellState = (n: number): CellState => {
    const a = answers[n];
    if (!a) return "empty";
    if (isRevealed(n)) return a === answerOf.get(n) ? "correct" : "wrong";
    return "answered";
  };

  const group = groups[groupIndex];
  const practiceAudio = mode === "practice" && !!group && group.part <= 4;
  const showScriptNow = !!group && instant && group.questionNumbers.every((n) => answers[n]);
  const title = mode === "full" ? "Thi thử" : `Luyện tập · Part ${parts.join(", ")}`;

  // ---------------- giao diện ----------------
  // Thẻ <audio> đặt cố định ở cùng vị trí trong cây để không bị unmount khi chuyển từ màn giới thiệu sang làm bài
  const audioEl = fullAudioUrl && (
          <audio
            ref={audioRef}
            src={fullAudioUrl}
            preload="auto"
            onLoadedMetadata={(e) => {
              const a = e.currentTarget;
              if (audioTimeRef.current && Math.abs(a.currentTime - audioTimeRef.current) > 1) a.currentTime = audioTimeRef.current;
              setAudioState((s) => ({ ...s, d: a.duration }));
            }}
            onTimeUpdate={(e) => {
              const a = e.currentTarget;
              audioTimeRef.current = a.currentTime;
              setAudioState({ t: a.currentTime, d: a.duration || 0, ended: a.ended });
              // thi thật: màn hình đi theo câu audio đang đọc
              if (synced && groupIndex < readingStart) {
                const li = listeningIndexAt(listening, a.currentTime);
                const gi = li < 0 ? 0 : groups.indexOf(listening[li]);
                if (gi !== groupIndex) setGroupIndex(gi);
              }
            }}
            onEnded={() => {
              setAudioState((s) => ({ ...s, ended: true }));
              // hết phần nghe → sang Reading
              if (cbt && groupIndex < readingStart && readingStart < groups.length) setGroupIndex(readingStart);
            }}
          />
        );

  if (phase === "intro") {
    return (
      <>
      {audioEl}
      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-line bg-surface p-8">
          <div className="text-sm font-semibold uppercase text-primary">{title}</div>
          <h1 className="mt-1 text-2xl font-bold">{test.title}</h1>
          <ul className="mt-4 space-y-1.5 text-sm text-muted">
            <li>• {total} câu{timeLimitSec ? ` · ${Math.round(timeLimitSec / 60)} phút, hết giờ tự nộp bài` : " · không giới hạn thời gian"}</li>
            {mode === "full" && <li>• Giao diện giống máy thi TOEIC trên máy tính. Hãy đeo tai nghe.</li>}
            {mode === "full" && synced && (
              <li>• Listening: audio phát liền một lần (~45 phút), màn hình tự chuyển theo câu đang đọc, không quay lại được.</li>
            )}
            {mode === "full" && !synced && <li>• Listening: audio phát liền một lần, bạn tự chuyển câu.</li>}
            {mode === "full" && <li>• Hết phần nghe tự sang Reading: làm tự do, đánh dấu câu để xem lại, dùng phím ← →.</li>}
            {mode !== "full" && <li>• Dùng phím ← → để chuyển nhóm câu.</li>}
            <li>• Bài làm được tự động lưu.</li>
          </ul>
          {saved ? (
            <div className="mt-6 rounded-lg bg-primary-soft p-4 text-sm">
              Bạn có bài làm dở: đã trả lời {answeredCount(saved.answers as Record<number, Letter>, groups)}/{total} câu, đã dùng{" "}
              {formatDuration(saved.elapsedSec)}.
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => begin(false)} className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary">
                  Tiếp tục làm
                </button>
                <button onClick={() => begin(true)} className="rounded-lg border border-line bg-surface px-4 py-2 font-semibold">
                  Làm lại từ đầu
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => begin(true)} className="mt-6 rounded-lg bg-primary px-6 py-2.5 font-semibold text-on-primary">
              Bắt đầu làm bài
            </button>
          )}
          <div className="mt-4">
            <Link href={`/tests/${test.id}`} className="text-sm text-muted hover:text-fg">
              ← Quay lại
            </Link>
          </div>
        </div>
      </main>
      </>
    );
  }

  if (cbt && group) {
    const section = groupIndex >= readingStart ? "reading" : "listening";
    // audio đang đọc phần hướng dẫn: trước câu đầu, hoặc sau câu cuối của một part mà chưa tới part kế
    const directionsPart = synced && section === "listening" && !audioState.ended ? directionsPartAt(listening, audioState.t) : null;
    return (
      <>
        {audioEl}
        <CbtRoom
          testId={test.id}
          groups={groups}
          groupIndex={groupIndex}
          section={section}
          directionsPart={directionsPart}
          locked={synced && section === "listening"}
          answers={answers}
          onSelect={select}
          flagged={flagged}
          onSetFlags={setFlags}
          answered={answered}
          total={total}
          remaining={remaining}
          volume={volume}
          onVolume={(v) => {
            setVolume(v);
            if (audioRef.current) audioRef.current.volume = v;
          }}
          audioBlocked={audioBlocked}
          onPlayAudio={startAudio}
          onGo={(gi, n) => goTo(gi, n)}
          canGo={(gi) => gi >= 0 && gi < groups.length && (!synced || (section === "reading" && gi >= readingStart))}
          onSubmit={submit}
          submitting={phase === "submitting"}
        />
      </>
    );
  }

  const nav = (
    <QuestionNav groups={groups} currentGroup={groupIndex} cellState={cellState} flagged={flagged} onJump={(gi, n) => goTo(gi, n)} />
  );

  return (
    <>
    {audioEl}
    <div className="flex flex-1 flex-col">
      {/* thanh trên */}
      <div ref={barRef} className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Link
            href={`/tests/${test.id}`}
            title="Thoát phòng thi (bài làm đã được lưu, có thể làm tiếp sau)"
            onClick={(e) => {
              if (!confirm("Thoát phòng thi? Bài làm đã được lưu, bạn có thể làm tiếp sau.")) e.preventDefault();
            }}
            className="hidden shrink-0 text-lg font-bold tracking-tight sm:block"
          >
            Toeic<span className="text-primary">Lab</span>
          </Link>
          <div className="w-full min-w-0 sm:w-auto sm:flex-1">
            <div className="truncate text-sm font-semibold">{test.title}</div>
            <div className="text-xs text-muted">{title}</div>
          </div>
          <div className="mr-auto text-sm text-muted sm:mr-0">
            <span className="hidden sm:inline">Đã làm </span>
            <b className="text-fg">{answered}</b>/{total}
          </div>
          <div
            className={`rounded-lg px-3 py-1 font-mono text-lg font-semibold tabular-nums ${
              remaining !== null && remaining <= 300 ? "bg-danger-soft text-danger" : "bg-surface-2"
            }`}
            aria-label="Thời gian"
          >
            {remaining !== null ? formatDuration(remaining) : formatDuration(elapsed)}
          </div>
          <button
            onClick={() => setConfirming(true)}
            disabled={phase === "submitting"}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary hover:opacity-90"
          >
            Nộp bài
          </button>
        </div>
        {fullAudioUrl && (
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 pb-2 text-xs text-muted">
            <span className="shrink-0">🎧 Listening</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: audioState.d ? `${(audioState.t / audioState.d) * 100}%` : "0%" }}
              />
            </div>
            <span className="shrink-0 tabular-nums">
              {audioState.ended ? "Đã hết phần nghe" : `${formatDuration(audioState.t)} / ${formatDuration(audioState.d)}`}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              aria-label="Âm lượng"
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (audioRef.current) audioRef.current.volume = v;
              }}
              className="w-20"
            />
            {audioBlocked && (
              <button onClick={startAudio} className="rounded bg-warn-soft px-2 py-0.5 font-semibold text-warn">
                Bấm để phát audio
              </button>
            )}
          </div>
        )}
        {/* luyện tập phần nghe: audio của nhóm câu nằm trong thanh dính, luôn thấy khi cuộn */}
        {practiceAudio && group && (
          <div className="mx-auto max-w-7xl px-4 pb-2">
            <AudioPlayer key={group.id} src={group.audio?.src ?? null} />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24">
        <div ref={mainRef} className="min-w-0 scroll-mt-32">
          {group && (
            <StepTransition index={groupIndex}>
            <GroupView
              key={group.id}
              group={group}
              answers={answers}
              onSelect={select}
              isRevealed={isRevealed}
              showScript={showScriptNow}
              showAudio={false}
              stickyTop={barH + 16}
              center
              flagged={flagged}
              onToggleFlag={toggleFlag}
            />
            </StepTransition>
          )}
        </div>

      </div>

      {/* thanh điều hướng gọn ở đáy: < [Câu x/y] > */}
      {group && (
        <StepNav
          label={`Câu ${groups.slice(0, groupIndex).reduce((n, g) => n + g.questions.length, 0) + 1}/${total}`}
          canPrev={groupIndex > 0}
          canNext={groupIndex < groups.length - 1}
          onPrev={() => goTo(groupIndex - 1)}
          onNext={() => goTo(groupIndex + 1)}
          listOpen={navOpen}
          onToggleList={() => setNavOpen((o) => !o)}
        />
      )}

      {/* bảng câu hỏi: mở bằng nút "Câu hỏi" trên thanh điều hướng */}
      <QuestionDrawer
        showButton={false}
        open={navOpen}
        onOpenChange={setNavOpen}
        summary={
          <>
            Đã làm <b className="text-fg">{answered}</b>/{total}
          </>
        }
        badge={`${answered}/${total}`}
      >
        {nav}
      </QuestionDrawer>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6">
            <h2 className="text-lg font-bold">Nộp bài?</h2>
            <p className="mt-2 text-sm text-muted">
              Bạn đã trả lời {answered}/{total} câu.
              {answered < total && <span className="text-warn"> Còn {total - answered} câu chưa làm.</span>}
              {flagged.size > 0 && <span> Có {flagged.size} câu đang đánh dấu.</span>}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirming(false)} className="rounded-lg border border-line px-4 py-2 font-medium">
                Làm tiếp
              </button>
              <button
                onClick={() => {
                  setConfirming(false);
                  submit();
                }}
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary"
              >
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
