"use client";
// Một dòng trong danh sách từ / cụm (kiểu "các thẻ trong bộ"): từ bên trái, nghĩa bên phải,
// nút đọc + gắn sao (dùng chung với bộ thẻ ghi nhớ) và thanh tiến độ ghi nhớ theo hộp ôn tập.

import type { ReactNode } from "react";
import { toggleStar } from "@/lib/stars";
import { VOCAB_INTERVALS, type VocabCard } from "@/lib/storage";

const BOXES = VOCAB_INTERVALS.length;

export function speakEn(text: string) {
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

const iconBtn = "grid size-8 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg";

export default function TermRow({
  id,
  term,
  speak,
  tags,
  meaning,
  below,
  card,
  starred,
  onReset,
}: {
  id: string;
  term: string;
  speak: string;
  /** dòng nhỏ dưới từ: loại từ, số đề, nhóm cụm… */
  tags?: ReactNode;
  meaning: string;
  /** dưới nghĩa: câu ví dụ, các dạng khác… */
  below?: ReactNode;
  card: VocabCard | undefined;
  starred: boolean;
  onReset: () => void;
}) {
  return (
    <li className="group rounded-2xl border border-line bg-surface px-4 py-3.5 transition hover:border-primary/40 sm:px-5">
      <div className="flex gap-3">
        <div className="grid min-w-0 flex-1 gap-x-6 gap-y-1.5 sm:grid-cols-[minmax(0,13rem)_1fr]">
          <div className="min-w-0">
            <div className="text-lg leading-7 font-semibold break-words">{term}</div>
            {tags && <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">{tags}</div>}
          </div>
          <div className="min-w-0 sm:border-l sm:border-line sm:pl-6">
            <div className="leading-7">{meaning}</div>
            {below && <div className="mt-1.5">{below}</div>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex">
            <button onClick={() => speakEn(speak)} aria-label={`Nghe phát âm ${term}`} className={iconBtn}>
              <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5 6 9H3v6h3l5 4V5zm4.5 3.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
              </svg>
            </button>
            <button
              onClick={() => toggleStar(id)}
              aria-label={starred ? `Bỏ gắn sao ${term}` : `Gắn sao ${term}`}
              aria-pressed={starred}
              className={`${iconBtn} ${starred ? "text-warn!" : ""}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]">
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
          <Mastery card={card} onReset={onReset} />
        </div>
      </div>
    </li>
  );
}

/** Thanh 5 nấc theo hộp ôn tập; đầy + xanh = đã thuộc. Nút ↺ (hiện khi rê chuột) để học lại từ đầu */
function Mastery({ card, onReset }: { card: VocabCard | undefined; onReset: () => void }) {
  if (!card) return <span className="pr-1 text-[11px] font-medium text-muted">Mới</span>;
  const mastered = card.box > BOXES;
  const filled = mastered ? BOXES : card.box;
  const title = mastered
    ? "Đã thuộc"
    : `Đang học: hộp ${card.box}/${BOXES} · ôn lại ngày ${new Date(card.due).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onReset}
        title="Học lại từ đầu"
        aria-label="Học lại từ đầu"
        className="text-xs text-muted opacity-0 transition group-hover:opacity-100 hover:text-danger focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      >
        ↺
      </button>
      <div className="flex gap-0.5" title={title} aria-label={title} role="img">
        {Array.from({ length: BOXES }, (_, i) => (
          <span key={i} className={`h-1.5 w-2.5 rounded-full ${i < filled ? (mastered ? "bg-success" : "bg-primary") : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}
