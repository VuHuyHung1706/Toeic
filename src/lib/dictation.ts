// Dựng bài "nghe điền từ" từ script của một nhóm câu Part 1–4
import type { QuestionGroup } from "./types";

export type Level = "easy" | "medium" | "hard";
export const LEVELS: { id: Level; label: string; ratio: number }[] = [
  { id: "easy", label: "Dễ", ratio: 0.15 },
  { id: "medium", label: "Vừa", ratio: 0.3 },
  { id: "hard", label: "Khó", ratio: 0.5 },
];

// Từ chức năng phổ biến — không đục lỗ để bài điền từ tập trung vào từ có nghĩa
const STOP = new Set(
  `a an the and or but if of to in on at by for with from as is are was were be been being am do does did have has had
  i you he she it we they me him her us them my your his its our their this that these those there here what which who
  whom whose when where why how not no yes so than too very can could will would shall should may might must just about
  into over after before up down out off then also all any some each other such only own same both few more most
  i'm you're he's she's it's we're they're i've you've we've they've i'll you'll he'll she'll we'll they'll i'd you'd
  he'd she'd we'd they'd isn't aren't wasn't weren't don't doesn't didn't haven't hasn't hadn't won't wouldn't can't
  couldn't shouldn't let's that's there's what's okay oh hi hello well`.split(/\s+/),
);

const SPEAKER_RE = /^(?:[WM]-(?:Am|Br|Cn|Au)|Man|Woman|M|W|M1|M2|W1|W2)\d?:?$/i;

export type Token =
  | { kind: "text"; text: string }
  | { kind: "blank"; id: number; answer: string; before: string; after: string };

export interface DictationLine {
  label?: string;
  text: string;
}

/** Script tiếng Anh của nhóm câu, tách thành từng dòng */
export function scriptLines(group: QuestionGroup): DictationLine[] {
  if (group.part === 1 || group.part === 2) {
    const q = group.questions[0];
    const lines: DictationLine[] = [];
    if (group.part === 2 && q.question) lines.push({ text: q.question });
    for (const L of ["A", "B", "C", "D"] as const) {
      const t = q.options[L];
      if (t) lines.push({ label: `(${L})`, text: t });
    }
    return lines;
  }
  const raw = group.passages.map((p) => p.en).filter(Boolean).join("\n");
  return raw
    .replace(/\*\*/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      // nhãn người nói: "W-Am", "M-Cn", "Man 1:", hoặc chỉ "W"/"M" ở đầu dòng (đề 2026)
      const m = l.match(/^((?:[WMwm]-(?:[Aa]m|[Bb]r|[Cc]n|[Aa]u))|(?:Man|Woman)\s*\d?|[WM]\d?)\s*:?\s+(.*)$/);
      return m ? { label: m[1], text: m[2] } : { text: l };
    });
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Tách dòng thành token, đục lỗ một phần các từ có nghĩa (giả ngẫu nhiên theo seed để ổn định) */
export function buildTokens(lines: DictationLine[], level: Level, seed: number): Token[][] {
  const ratio = LEVELS.find((l) => l.id === level)!.ratio;
  let id = 0;
  return lines.map((line, li) =>
    line.text.split(/(\s+)/).map((part, pi): Token => {
      const m = part.match(/^([^\p{L}\p{N}]*)([\p{L}][\p{L}'’-]*[\p{L}]|[\p{L}]{1,2})([^\p{L}\p{N}]*)$/u);
      if (!m) return { kind: "text", text: part };
      const [, before, word, after] = m;
      const lower = word.toLowerCase().replace(/’/g, "'");
      const eligible = word.length >= 3 && !STOP.has(lower) && !SPEAKER_RE.test(word) && !/^[A-Z]{2,}$/.test(word);
      if (eligible && hash(`${seed}:${li}:${pi}:${lower}`) < ratio) {
        return { kind: "blank", id: id++, answer: word, before, after };
      }
      return { kind: "text", text: part };
    }),
  );
}

export function normalizeWord(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}'-]/gu, "");
}
