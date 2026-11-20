"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AudioPlayer from "./AudioPlayer";
import GroupView from "./GroupView";
import QuestionNav, { answeredCount, type CellState } from "./QuestionNav";
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

  // ngăn bảng câu: mở ra thì cuộn tới câu đang làm; Esc để đóng
  const navPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!navOpen) return;
    navPanelRef.current?.querySelector("[data-current]")?.scrollIntoView({ block: "center" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

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
      if (e.key === "ArrowRight") goTo(groupIndex + 1);
      if (e.key === "ArrowLeft") goTo(groupIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, groupIndex, goTo]);

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
    if (fullAudioUrl) startAudio();
  };

  const select = (n: number, l: Letter) => {
    setAnswers((a) => ({ ...a, [n]: l }));
  };
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
  // nhóm có cột ảnh/bài đọc (cùng điều kiện với GroupView) → nội dung trải rộng; không có → căn giữa
  const sideCol =
    !!group && (group.images.some((i) => i.src) || (group.passages.some((p) => p.en || p.vi) && (group.part > 4 || showScriptNow)));
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
            }}
            onEnded={() => setAudioState((s) => ({ ...s, ended: true }))}
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
            {mode === "full" && <li>• Audio Listening phát liền một lần (~45 phút), không tua được. Hãy đeo tai nghe.</li>}
            {mode === "full" && <li>• Trong lúc nghe bạn vẫn có thể chuyển câu tự do, kể cả sang phần Reading.</li>}
            <li>• Dùng phím ← → để chuyển nhóm câu. Bài làm được tự động lưu.</li>
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
          )}
          <div className={`mt-6 flex items-center justify-between gap-3 ${sideCol ? "" : "mx-auto max-w-3xl"}`}>
            <button
              onClick={() => goTo(groupIndex - 1)}
              disabled={groupIndex === 0}
              className="rounded-lg border border-line bg-surface px-4 py-2 font-medium disabled:opacity-40"
            >
              ← Trước
            </button>
            <span className="text-sm text-muted">
              Nhóm {groupIndex + 1}/{groups.length}
            </span>
            {groupIndex < groups.length - 1 ? (
              <button onClick={() => goTo(groupIndex + 1)} className="rounded-lg border border-line bg-surface px-4 py-2 font-medium">
                Tiếp →
              </button>
            ) : (
              <button onClick={() => setConfirming(true)} className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary">
                Nộp bài
              </button>
            )}
          </div>
        </div>

      </div>

      {/* bảng câu hỏi: ngăn bật/tắt bằng nút nổi góc dưới phải (điện thoại: trượt từ dưới lên; máy tính: bên phải) */}
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setNavOpen(false)}>
          <div
            ref={navPanelRef}
            role="dialog"
            aria-label="Danh sách câu hỏi"
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-surface p-4 pb-24 shadow-xl lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-80 lg:rounded-none lg:rounded-l-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Câu hỏi</h2>
              <span className="text-sm text-muted">
                Đã làm <b className="text-fg">{answered}</b>/{total}
              </span>
            </div>
            {nav}
          </div>
        </div>
      )}
      <button
        onClick={() => setNavOpen((o) => !o)}
        aria-expanded={navOpen}
        aria-label={navOpen ? "Đóng danh sách câu hỏi" : "Mở danh sách câu hỏi"}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[45] flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary/30 hover:opacity-90"
      >
        {navOpen ? (
          <span aria-hidden className="text-base leading-none">✕</span>
        ) : (
          <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="currentColor">
            <path d="M3 3h4v4H3zM8 3h4v4H8zM13 3h4v4h-4zM3 8h4v4H3zM8 8h4v4H8zM13 8h4v4h-4zM3 13h4v4H3zM8 13h4v4H8zM13 13h4v4h-4z" />
          </svg>
        )}
        {navOpen ? "Đóng" : "Câu hỏi"}
        {!navOpen && <span className="rounded-full bg-on-primary/20 px-1.5 text-xs tabular-nums">{answered}/{total}</span>}
      </button>

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
