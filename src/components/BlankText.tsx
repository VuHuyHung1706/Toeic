"use client";

import type { ReactNode } from "react";
import type { Letter, Question } from "@/lib/types";

/** Nhảy tới câu hỏi và nháy viền để dễ thấy */
function jumpTo(n: number) {
  const el = document.getElementById(`q-${n}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-primary");
  setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1200);
}

export interface BlankOptions {
  questions: Question[];
  answers: Record<number, Letter>;
  isRevealed: (n: number) => boolean;
  /** "vi": điền nghĩa tiếng Việt của phương án (nếu có) thay cho bản tiếng Anh */
  lang: "en" | "vi";
}

function optionText(q: Question, letter: Letter, lang: "en" | "vi") {
  const en = (q.options[letter] ?? "").trim();
  if (lang === "vi") return q.optionNotes?.[letter]?.meaning || en;
  return en;
}

/**
 * Part 6: thay "135-----", "131.......", "132———" trong đoạn văn bằng nhãn số câu nổi bật.
 * - Chưa trả lời: nhãn "135 ____".
 * - Đã chọn: điền luôn đáp án đã chọn vào chỗ trống.
 * - Đã chấm: đúng → tô xanh; sai → gạch đáp án đã chọn và hiện đáp án đúng bên cạnh.
 * Bấm nhãn → cuộn tới câu hỏi.
 */
export function renderBlanks(text: string, opts: BlankOptions): ReactNode {
  const { questions, answers, isRevealed, lang } = opts;
  if (!questions.length) return text;
  const byNumber = new Map(questions.map((q) => [q.number, q]));
  // chỗ trống: "-----", "———", "____" (dấu câu phía sau giữ nguyên) hoặc "......." (gộp luôn dấu chấm)
  const re = new RegExp(`(?<!\\d)(${[...byNumber.keys()].join("|")})(?!\\d)\\s?(?:(?:[-–—_]\\s?){2,}|[.…]{2,})`, "g");
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    const q = byNumber.get(n)!;
    const chosen = answers[n];
    const revealed = isRevealed(n);
    const correct = !!chosen && chosen === q.answer;
    out.push(text.slice(last, m.index));

    const tone = !chosen
      ? revealed
        ? "bg-warn-soft text-warn ring-1 ring-warn/50" // bỏ trống, đã chấm → hiện đáp án đúng
        : "bg-primary text-on-primary"
      : !revealed
        ? "bg-primary-soft text-primary ring-1 ring-primary/40"
        : correct
          ? "bg-success-soft text-success ring-1 ring-success/50"
          : "bg-danger-soft text-danger ring-1 ring-danger/50";
    out.push(
      <button
        key={`${n}-${m.index}`}
        type="button"
        onClick={() => jumpTo(n)}
        title={`Tới câu ${n}`}
        className={`mx-0.5 inline rounded-md px-1.5 py-px text-left font-semibold leading-7 [box-decoration-break:clone] hover:opacity-90 ${tone}`}
      >
        <sup className="mr-1 text-[10px] font-bold opacity-80">{n}</sup>
        {!chosen && revealed && q.answer ? (
          <>bỏ trống → {optionText(q, q.answer, lang)}</>
        ) : !chosen ? (
          <span className="inline-block min-w-10 rounded bg-white/25 px-1 text-center text-xs">____</span>
        ) : revealed && !correct ? (
          <>
            <span className="line-through opacity-70">{optionText(q, chosen, lang)}</span>{" "}
            {q.answer && <span className="text-success">→ {optionText(q, q.answer, lang)}</span>}
          </>
        ) : (
          optionText(q, chosen, lang)
        )}
      </button>,
    );
    last = (m.index ?? 0) + m[0].length;
    // chỗ trống điền cả câu (mọi phương án là câu hoàn chỉnh có dấu chấm): dữ liệu vẫn ghi "131 ----- . The…"
    // → bỏ dấu chấm thừa ngay sau chỗ trống, kẻo hiện ". The nursery…"
    const sentenceBlank = (["A", "B", "C", "D"] as Letter[]).every((L) => /[.!?]["”]?\s*$/.test(q.options[L] ?? ""));
    if (sentenceBlank) {
      const stray = text.slice(last).match(/^\s*\.(?!\.)/);
      if (stray) last += stray[0].length;
    }
  }
  out.push(text.slice(last));
  return out;
}
