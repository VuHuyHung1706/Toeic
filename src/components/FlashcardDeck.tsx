"use client";
// Bộ thẻ ghi nhớ (dùng cho "Từ theo đề" và "Cụm giới từ"):
// - thẻ lớn lật 3D (bấm thẻ / Space), gợi ý (câu ví dụ che từ), đọc phát âm, gắn sao;
// - chế độ "Phân loại" (mặc định): Chưa nhớ / Nhớ rồi → ghi vào lịch ôn ngắt quãng; vuốt trái/phải trên điện thoại;
// - chế độ xem lướt: ‹ › chuyển thẻ, tự chạy; trộn thẻ; cài đặt (mặt hiện trước, tự đọc, tốc độ, chỉ thẻ gắn sao); toàn màn hình.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toggleStar, useStars } from "@/lib/stars";
import { reviewVocab, setPref, usePref } from "@/lib/storage";

export interface DeckCard {
  /** khoá thẻ trong lịch ôn (vd từ "submit", cụm "cgt:verb:add A to B") */
  id: string;
  /** mặt tiếng Anh */
  term: string;
  /** dòng nhỏ dưới mặt tiếng Anh: loại từ, nhóm cụm… */
  tag?: string;
  /** nghĩa tiếng Việt */
  meaning: string;
  /** chữ để đọc phát âm */
  speak: string;
  /** gợi ý ở mặt trước (vd câu ví dụ đã che từ) */
  hint?: ReactNode;
  /** nội dung thêm ở mặt sau (câu ví dụ, dạng khác của từ) */
  details?: ReactNode;
}

type Verdict = "know" | "learning";

function say(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* trình duyệt không hỗ trợ đọc */
  }
}

function shuffled<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// ---- icon nhỏ (nét giống icon menu) ----
const s = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  bulb: <path {...s} d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z" />,
  sound: <path {...s} d="M11 5 6 9H3v6h3l5 4V5zm4.5 3.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />,
  star: <path {...s} d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />,
  prev: <path {...s} d="M19 12H5m6-6-6 6 6 6" />,
  next: <path {...s} d="M5 12h14m-6-6 6 6-6 6" />,
  play: <path d="M8 5v14l11-7z" fill="currentColor" />,
  pause: <path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor" />,
  shuffle: <path {...s} d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />,
  gear: (
    <>
      <circle {...s} cx="12" cy="12" r="3" />
      <path {...s} d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  expand: <path {...s} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path {...s} d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  check: <path {...s} d="m5 12 5 5L20 7" />,
  x: <path {...s} d="M6 6l12 12M18 6 6 18" />,
};
const Ico = ({ d, className = "size-5" }: { d: ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className}>
    {d}
  </svg>
);

/** active = false khi mục chứa bộ thẻ đang bị ẩn (chuyển sang tab khác): giữ nguyên tiến độ nhưng không nhận phím, không tự chạy */
export default function FlashcardDeck({ cards: initial, onExit, active = true }: { cards: DeckCard[]; onExit: () => void; active?: boolean }) {
  // ---- cài đặt (nhớ theo người dùng) ----
  const frontSide = usePref<"term" | "meaning">("fcFront", "term");
  const autoSpeak = usePref<"0" | "1">("fcSpeak", "0") === "1";
  const speed = Number(usePref<"3" | "5" | "8">("fcSpeed", "5"));
  const starred = useStars();

  // "chỉ thẻ gắn sao": chụp danh sách lúc bật, để bỏ sao giữa chừng không làm nhảy thẻ
  const [starSnap, setStarSnap] = useState<Set<string> | null>(null);
  const onlyStarred = starSnap !== null;
  const setOnlyStarred = (on: boolean) => setStarSnap(on ? new Set(starred) : null);
  const [order, setOrder] = useState<DeckCard[]>(initial);
  const deck = useMemo(() => (starSnap ? order.filter((c) => starSnap.has(c.id)) : order), [order, starSnap]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(false);
  const [sortMode, setSortMode] = useState(true);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [playing, setPlaying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [leaving, setLeaving] = useState<null | "left" | "right">(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const card = deck[pos];
  const starCount = order.filter((c) => starred.has(c.id)).length;
  const finished = pos >= deck.length;
  const know = Object.values(verdicts).filter((v) => v === "know").length;
  const learning = Object.values(verdicts).filter((v) => v === "learning").length;

  const goto = useCallback((i: number) => {
    setPos(i);
    setFlipped(false);
    setHint(false);
  }, []);
  const next = useCallback(() => goto(Math.min(pos + 1, deck.length)), [goto, pos, deck.length]);
  const prev = useCallback(() => goto(Math.max(pos - 1, 0)), [goto, pos]);
  const flip = useCallback(() => setFlipped((f) => !f), []);

  /** Phân loại thẻ hiện tại: ghi lịch ôn, thẻ bay sang trái/phải rồi sang thẻ sau */
  const sort = useCallback(
    (v: Verdict) => {
      if (!card || leaving) return;
      reviewVocab(card.id, v === "know");
      setVerdicts((m) => ({ ...m, [card.id]: v }));
      setLeaving(v === "know" ? "right" : "left");
      setTimeout(() => {
        setLeaving(null);
        next();
      }, 220);
    },
    [card, leaving, next],
  );

  // tự đọc khi tới thẻ mới (mặt tiếng Anh ở trước)
  useEffect(() => {
    if (active && autoSpeak && card && frontSide === "term" && !flipped) say(card.speak);
  }, [active, autoSpeak, card, frontSide, flipped]);

  // tự chạy: lật → sang thẻ sau
  useEffect(() => {
    if (!playing || !active || finished) return;
    const t = setTimeout(() => {
      if (!flipped) return setFlipped(true);
      if (pos + 1 >= deck.length) setPlaying(false); // hết bộ thẻ → dừng
      next();
    }, speed * 1000);
    return () => clearTimeout(t);
  }, [playing, active, flipped, finished, next, speed, pos, deck.length]);

  // bấm ra ngoài / Esc → đóng bảng cài đặt
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) setSettingsOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setSettingsOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [settingsOpen]);

  // toàn màn hình
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  // phím tắt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName;
      if (!active || t === "INPUT" || t === "SELECT" || t === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey || finished) return;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        flip();
      } else if (e.key === "ArrowLeft" || e.key === "1") {
        if (sortMode) sort("learning");
        else prev();
      } else if (e.key === "ArrowRight" || e.key === "2") {
        if (sortMode) sort("know");
        else next();
      } else if (e.key.toLowerCase() === "h") setHint((h) => !h);
      else if (e.key.toLowerCase() === "s" && card) toggleStar(card.id);
      else if (e.key.toLowerCase() === "f") toggleFull();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- vuốt (kéo) thẻ ----
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [dx, setDx] = useState(0);
  const moved = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const d = e.clientX - drag.current.x;
    if (Math.abs(d) > 8 && Math.abs(d) > Math.abs(e.clientY - drag.current.y)) {
      moved.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDx(d);
    }
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    const d = dx;
    setDx(0);
    if (Math.abs(d) < 90) return;
    if (sortMode) sort(d > 0 ? "know" : "learning");
    else if (d > 0) prev();
    else next();
  };

  // ---- kết thúc ----
  if (finished) {
    const again = deck.filter((c) => verdicts[c.id] === "learning");
    return (
      <div className="mt-6 rounded-3xl border border-line bg-surface p-8 text-center">
        <div className="text-sm text-muted">Hoàn thành bộ thẻ</div>
        <div className="mt-2 text-4xl font-bold">{deck.length} thẻ</div>
        {sortMode && (
          <div className="mt-4 flex justify-center gap-3 text-sm font-semibold">
            <span className="rounded-full bg-success-soft px-4 py-1.5 text-success">Nhớ rồi {know}</span>
            <span className="rounded-full bg-danger-soft px-4 py-1.5 text-danger">Chưa nhớ {learning}</span>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {again.length > 0 && (
            <button
              onClick={() => {
                setOrder(again);
                setOnlyStarred(false);
                setVerdicts({});
                goto(0);
              }}
              className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary hover:opacity-90"
            >
              Học lại {again.length} thẻ chưa nhớ
            </button>
          )}
          <button
            onClick={() => {
              setVerdicts({});
              goto(0);
            }}
            className="rounded-xl border border-line px-5 py-2.5 font-semibold hover:bg-surface-2"
          >
            Xem lại từ đầu
          </button>
          <button onClick={onExit} className="rounded-xl border border-line px-5 py-2.5 font-semibold hover:bg-surface-2">
            Xong
          </button>
        </div>
      </div>
    );
  }
  if (!card) return null;

  const termFirst = frontSide === "term";
  const tilt = Math.max(-12, Math.min(12, dx / 18));
  const glow = sortMode && Math.abs(dx) > 40 ? (dx > 0 ? "ring-4 ring-success/50" : "ring-4 ring-danger/50") : "";
  const iconBtn = "grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg";

  const face = (side: "term" | "meaning") =>
    side === "term" ? (
      <div className="text-center">
        <div className="text-3xl font-semibold tracking-tight sm:text-5xl">{card.term}</div>
        {card.tag && <div className="mt-3 text-sm text-muted">{card.tag}</div>}
      </div>
    ) : (
      <div className="text-center">
        <div className="text-2xl font-semibold text-primary sm:text-3xl">{card.meaning}</div>
      </div>
    );

  return (
    <div ref={rootRef} className={`mt-6 ${full ? "flex flex-col justify-center bg-bg p-6 sm:p-10" : ""}`}>
      {/* thanh trên: thoát, tiến độ, số đã phân loại */}
      <div className="mb-3 flex items-center gap-3 text-sm text-muted">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-medium text-muted transition hover:bg-surface-2 hover:text-fg"
        >
          <Ico d={I.prev} className="size-4" />
          Thoát
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(pos / deck.length) * 100}%` }} />
        </div>
        {sortMode && (
          <span className="flex gap-1.5 font-semibold tabular-nums">
            <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-danger" title="Chưa nhớ">
              {learning}
            </span>
            <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-success" title="Nhớ rồi">
              {know}
            </span>
          </span>
        )}
      </div>

      {/* thẻ */}
      <div className="[perspective:1600px]">
        {/* key theo thẻ: thẻ mới dựng lại từ đầu (không trượt về từ chỗ thẻ cũ bay đi, không lộ mặt sau) */}
        <div
          key={`${card.id}:${pos}`}
          role="button"
          tabIndex={0}
          aria-label={flipped ? "Úp thẻ" : "Lật thẻ"}
          onClick={() => {
            if (!moved.current) flip();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`step-fade relative h-[22rem] cursor-pointer touch-pan-y select-none sm:h-[30rem] ${full ? "sm:h-[60vh]" : ""} ${glow} rounded-3xl ${
            dx ? "" : "transition-transform duration-200"
          } motion-reduce:transition-none`}
          style={{
            transform:
              leaving === "right"
                ? "translateX(120%) rotate(12deg)"
                : leaving === "left"
                  ? "translateX(-120%) rotate(-12deg)"
                  : `translateX(${dx}px) rotate(${tilt}deg)`,
            opacity: leaving ? 0 : 1,
            transition: leaving ? "transform 220ms ease-in, opacity 220ms ease-in" : undefined,
          }}
        >
          <div
            className="relative size-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none"
            style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
          >
            {/* mặt trước */}
            <div className="absolute inset-0 flex flex-col rounded-3xl border border-line bg-surface p-5 shadow-sm [backface-visibility:hidden] sm:p-7">
              <div className="flex items-center justify-between">
                {card.hint && termFirst ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHint((h) => !h);
                    }}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
                  >
                    <Ico d={I.bulb} className="size-4" />
                    {hint ? "Ẩn gợi ý" : "Hiển thị gợi ý"}
                  </button>
                ) : (
                  <span />
                )}
                <CardIcons card={card} starred={starred.has(card.id)} onStar={() => toggleStar(card.id)} iconBtn={iconBtn} />
              </div>
              <div className="-mx-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
                <div className="my-auto flex flex-col items-center gap-5 py-2">
                  {face(termFirst ? "term" : "meaning")}
                  {hint && termFirst && card.hint && (
                    <div className="step-fade max-w-xl rounded-xl bg-surface-2 px-4 py-3 text-center text-sm leading-6 text-muted">{card.hint}</div>
                  )}
                </div>
              </div>
              <div className="text-center text-xs text-muted">
                <span className="sm:hidden">Chạm vào thẻ để lật</span>
                <span className="hidden sm:inline">Bấm thẻ hoặc Space để lật</span>
              </div>
            </div>
            {/* mặt sau */}
            <div className="absolute inset-0 flex flex-col rounded-3xl border border-line bg-surface p-5 shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate px-1 text-sm font-semibold text-muted">{termFirst ? card.term : card.meaning}</span>
                <CardIcons card={card} starred={starred.has(card.id)} onStar={() => toggleStar(card.id)} iconBtn={iconBtn} />
              </div>
              {/* my-auto thay cho justify-center: nội dung dài vẫn cuộn được từ đầu, không bị cắt mất phần trên */}
              <div className="-mx-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
                <div className="my-auto flex flex-col items-center gap-4 py-2">
                  {face(termFirst ? "meaning" : "term")}
                  {card.details && <div className="w-full max-w-2xl text-left text-sm leading-6">{card.details}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* thanh điều khiển */}
      {/* điện thoại: hàng 1 = Chưa nhớ · x/y · Nhớ rồi, hàng 2 = Phân loại + công cụ; máy tính: một hàng */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-3 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <button
            onClick={() => {
              setSortMode((m) => !m);
              setPlaying(false);
            }}
            aria-pressed={sortMode}
            className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              sortMode ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted hover:text-fg"
            }`}
            title="Phân loại: Chưa nhớ / Nhớ rồi (ghi vào lịch ôn)"
          >
            <span className="hidden sm:inline">Phân loại thẻ</span>
            <span className="sm:hidden">Phân loại</span>
          </button>
        </div>

        {sortMode ? (
          <div className="order-first flex w-full items-center justify-center gap-2 sm:order-none sm:w-auto">
            <button
              onClick={() => sort("learning")}
              aria-label="Chưa nhớ"
              title="Chưa nhớ (← hoặc 1)"
              className="grid h-12 w-16 place-items-center rounded-full border border-danger/40 bg-danger-soft text-danger transition hover:scale-105 sm:w-20"
            >
              <Ico d={I.x} className="size-6" />
            </button>
            <span className="min-w-16 text-center text-sm font-semibold tabular-nums text-muted">
              {pos + 1} / {deck.length}
            </span>
            <button
              onClick={() => sort("know")}
              aria-label="Nhớ rồi"
              title="Nhớ rồi (→ hoặc 2)"
              className="grid h-12 w-16 place-items-center rounded-full border border-success/40 bg-success-soft text-success transition hover:scale-105 sm:w-20"
            >
              <Ico d={I.check} className="size-6" />
            </button>
          </div>
        ) : (
          <div className="order-first flex w-full items-center justify-center gap-2 sm:order-none sm:w-auto">
            <button onClick={prev} disabled={pos === 0} aria-label="Thẻ trước" className="grid h-12 w-16 place-items-center rounded-full bg-surface-2 transition hover:bg-line disabled:opacity-40 sm:w-20">
              <Ico d={I.prev} />
            </button>
            <span className="min-w-16 text-center text-sm font-semibold tabular-nums text-muted">
              {pos + 1} / {deck.length}
            </span>
            <button onClick={next} aria-label="Thẻ sau" className="grid h-12 w-16 place-items-center rounded-full bg-surface-2 transition hover:bg-line sm:w-20">
              <Ico d={I.next} />
            </button>
          </div>
        )}

        <div ref={settingsRef} className="relative flex justify-end gap-1">
          <button
            onClick={() => {
              setSortMode(false);
              setPlaying((p) => !p);
            }}
            aria-label={playing ? "Dừng tự chạy" : "Tự chạy"}
            title="Tự chạy (lật rồi sang thẻ sau)"
            className={`${iconBtn} ${playing ? "bg-primary-soft text-primary" : ""}`}
          >
            <Ico d={playing ? I.pause : I.play} />
          </button>
          <button
            onClick={() => {
              setOrder((o) => [...o.slice(0, pos), ...shuffled(o.slice(pos))]);
              setFlipped(false);
            }}
            aria-label="Trộn thẻ"
            title="Trộn các thẻ chưa xem"
            className={iconBtn}
          >
            <Ico d={I.shuffle} />
          </button>
          <button onClick={() => setSettingsOpen((o) => !o)} aria-label="Cài đặt" aria-expanded={settingsOpen} className={`${iconBtn} ${settingsOpen ? "bg-surface-2 text-fg" : ""}`}>
            <Ico d={I.gear} />
          </button>
          <button onClick={toggleFull} aria-label={full ? "Thoát toàn màn hình" : "Toàn màn hình"} title="Toàn màn hình (F)" className={`${iconBtn} hidden sm:grid`}>
            <Ico d={full ? I.shrink : I.expand} />
          </button>

          {settingsOpen && (
            <div className="step-fade absolute right-0 bottom-12 z-20 w-72 rounded-2xl border border-line bg-surface p-4 text-sm shadow-xl">
              <div className="font-semibold">Cài đặt thẻ</div>
              <Setting label="Mặt hiện trước">
                <Choice value={frontSide} options={[["term", "Tiếng Anh"], ["meaning", "Nghĩa"]]} onChange={(v) => setPref("fcFront", v)} />
              </Setting>
              <Setting label="Tự đọc phát âm">
                <Choice value={autoSpeak ? "1" : "0"} options={[["1", "Bật"], ["0", "Tắt"]]} onChange={(v) => setPref("fcSpeak", v)} />
              </Setting>
              <Setting label="Tốc độ tự chạy">
                <Choice value={String(speed)} options={[["3", "3 giây"], ["5", "5 giây"], ["8", "8 giây"]]} onChange={(v) => setPref("fcSpeed", v)} />
              </Setting>
              <Setting label={`Chỉ học thẻ gắn sao (${starCount})`}>
                <Choice
                  value={onlyStarred ? "1" : "0"}
                  options={[["1", "Bật"], ["0", "Tắt"]]}
                  onChange={(v) => {
                    if (v === "1" && !starCount) return;
                    setOnlyStarred(v === "1");
                    goto(0);
                  }}
                />
              </Setting>
              <div className="mt-3 border-t border-line pt-3 text-xs leading-5 text-muted">
                Phím tắt: Space lật · ← → {sortMode ? "chưa nhớ / nhớ rồi" : "chuyển thẻ"} · H gợi ý · S gắn sao · F toàn màn hình
              </div>
            </div>
          )}
        </div>
      </div>
      {sortMode && <p className="mt-3 text-center text-xs text-muted sm:hidden">Vuốt phải: nhớ rồi · vuốt trái: chưa nhớ</p>}
    </div>
  );
}

function CardIcons({ card, starred, onStar, iconBtn }: { card: DeckCard; starred: boolean; onStar: () => void; iconBtn: string }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          say(card.speak);
        }}
        aria-label="Nghe phát âm"
        className={iconBtn}
      >
        <Ico d={I.sound} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStar();
        }}
        aria-label={starred ? "Bỏ gắn sao" : "Gắn sao"}
        aria-pressed={starred}
        className={`${iconBtn} ${starred ? "text-warn!" : ""}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-5">
          <path
            d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"
            fill={starred ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-xs text-muted">{label}</div>
      {children}
    </div>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 rounded-lg px-2 py-1.5 font-medium transition ${value === v ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
