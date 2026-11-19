"use client";

import type { ReactNode } from "react";

/** Số màu tô dẫn chứng (lớp .hl-1 … .hl-5 trong globals.css) */
export const HL_COLORS = 5;

export interface EvidenceItem {
  /** Số câu hỏi */
  n: number;
  /** Các đoạn nguyên văn trong bài đọc */
  spans: string[];
  /** Lớp màu, vd "hl-2" */
  cls: string;
}

function flexPattern(span: string) {
  const words = span.trim().replace(/^[\s.,;:]+|[\s.,;:]+$/g, "").split(/\s+/);
  if (words.length < 3) return null;
  const parts = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]"));
  return new RegExp(parts.join("\\s+"), "i");
}

/** Tô màu các đoạn dẫn chứng của từng câu hỏi trong văn bản (đoạn chồng lấn thì giữ đoạn đứng trước). */
export function highlightEvidence(text: string, items: EvidenceItem[]): ReactNode {
  const ranges: { start: number; end: number; n: number; cls: string }[] = [];
  for (const it of items) {
    for (const span of it.spans) {
      const re = flexPattern(span);
      const m = re?.exec(text);
      if (m) ranges.push({ start: m.index, end: m.index + m[0].length, n: it.n, cls: it.cls });
    }
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue; // chồng lấn với đoạn trước
    out.push(text.slice(pos, r.start));
    out.push(
      <mark key={`${r.n}-${r.start}`} data-q={r.n} title={`Dẫn chứng câu ${r.n}`} className={`rounded px-0.5 text-inherit ${r.cls}`}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    pos = r.end;
  }
  out.push(text.slice(pos));
  return out;
}

/** Cuộn tới đoạn dẫn chứng đầu tiên của câu n và nháy viền */
export function jumpToEvidence(n: number) {
  const el = document.querySelector<HTMLElement>(`mark[data-q="${n}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-fg/50");
  setTimeout(() => el.classList.remove("ring-2", "ring-fg/50"), 1200);
}

/** Câu dịch tiếng Việt: tô cả câu nếu câu tiếng Anh đi kèm có chứa dẫn chứng */
export function highlightPair(vi: string, pairEn: string, items: EvidenceItem[]): ReactNode {
  for (const it of items)
    for (const span of it.spans)
      if (flexPattern(span)?.test(pairEn))
        return (
          <mark data-q-vi={it.n} className={`rounded px-0.5 text-inherit ${it.cls}`}>
            {vi}
          </mark>
        );
  return vi;
}
