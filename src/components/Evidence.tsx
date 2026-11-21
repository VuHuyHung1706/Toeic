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

// từ viết tắt có dấu chấm không kết thúc câu (Mr. Park, Co. Ltd., e.g. …)
const ABBR = /(?:\b(?:Mr|Mrs|Ms|Dr|St|Inc|Co|Ltd|Jr|Sr|No|vs|Corp|Dept|Ave|approx|etc)|\b[A-Z]|e\.g|i\.e)\.$/;

/**
 * Tách đoạn văn thành câu: [vị trí bắt đầu, vị trí kết thúc] (kể cả dấu câu, không gồm khoảng trắng phía sau).
 * Không tách ở dấu chấm trong ngoặc ("(9:06 A.M.) Good morning"). strict: không tách sau từ viết tắt (Mr., Ave.).
 */
function sentenceRanges(text: string, strict: boolean): [number, number][] {
  const out: [number, number][] = [];
  const re = /[.!?…]["”’]*\s+(?=["“(]?\p{Lu})/gu;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].trimEnd().length;
    const head = text.slice(start, end);
    if (strict && ABBR.test(head) && !/[A-Z]\.[A-Z]\.$/.test(head)) continue;
    out.push([start, end]);
    start = m.index + m[0].length;
  }
  if (start < text.length) out.push([start, text.length]);
  return out;
}

/**
 * Bản dịch tiếng Việt: tô đúng câu dịch của câu tiếng Anh chứa dẫn chứng, cùng màu với dẫn chứng.
 * Đoạn tiếng Anh và tiếng Việt được tách thành câu và ghép theo thứ tự; nếu số câu hai bên không khớp
 * (không ghép chắc chắn được) thì không tô, để tránh tô nhầm cả đoạn.
 */
export function highlightPair(vi: string, pairEn: string, items: EvidenceItem[]): ReactNode {
  // thử tách chặt (bỏ qua từ viết tắt) trước, rồi lỏng hơn — chọn cách cho số câu hai bên bằng nhau
  let en = sentenceRanges(pairEn, true);
  let vs = sentenceRanges(vi, true);
  if (en.length !== vs.length)
    for (const [a, b] of [[false, false], [false, true], [true, false]] as const) {
      const e2 = sentenceRanges(pairEn, a);
      const v2 = sentenceRanges(vi, b);
      if (e2.length === v2.length) {
        en = e2;
        vs = v2;
        break;
      }
    }
  // câu tiếng Anh thứ i chứa dẫn chứng của câu hỏi nào (đoạn dẫn chứng có thể kéo qua nhiều câu)
  const mark = new Map<number, EvidenceItem>();
  for (const it of items)
    for (const span of it.spans) {
      const m = flexPattern(span)?.exec(pairEn);
      if (!m) continue;
      const a = m.index;
      const b = m.index + m[0].length;
      en.forEach(([s, e], i) => {
        if (s < b && a < e && !mark.has(i)) mark.set(i, it);
      });
    }
  if (!mark.size) return vi;
  // tiếng Anh chỉ có một câu → bản dịch cả đoạn chính là câu đó
  if (en.length === 1) {
    const it = mark.get(0)!;
    return (
      <mark data-q-vi={it.n} className={`rounded px-0.5 text-inherit ${it.cls}`}>
        {vi}
      </mark>
    );
  }
  if (en.length !== vs.length) return vi;

  const out: ReactNode[] = [];
  let pos = 0;
  vs.forEach(([s, e], i) => {
    const it = mark.get(i);
    if (!it) return;
    out.push(vi.slice(pos, s));
    out.push(
      <mark key={s} data-q-vi={it.n} className={`rounded px-0.5 text-inherit ${it.cls}`}>
        {vi.slice(s, e)}
      </mark>,
    );
    pos = e;
  });
  out.push(vi.slice(pos));
  return out;
}
