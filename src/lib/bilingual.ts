// Ghép bản tiếng Anh và bản dịch tiếng Việt thành từng cặp câu để hiển thị song ngữ.
//
// Dữ liệu đề lưu bản gốc và bản dịch thành hai khối văn bản riêng, số câu không phải lúc nào cũng
// bằng nhau (vd "Dr. Miller" được dịch thành "bác sĩ. Miller" → thêm một câu). Vì vậy:
//   1. Nếu hai bản có cùng số dòng → ghép từng dòng với nhau (giữ đúng đoạn / lượt lời).
//   2. Trong mỗi dòng (hoặc cả khối nếu số dòng lệch) → căn câu theo độ dài kiểu Gale–Church:
//      cho phép ghép 1–1, 1–2, 2–1, 1–3, 3–1 câu, chọn cách có tổng độ lệch độ dài nhỏ nhất.

export interface BilingualPair {
  en: string;
  vi: string;
  /** Cặp đầu tiên của một dòng/đoạn mới trong bản gốc */
  newParagraph: boolean;
}

const lines = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

// Tách câu: sau . ! ? và trước chữ hoa / số / ngoặc; không tách sau các từ viết tắt thường gặp
const SENTENCE_RE =
  /(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Inc|Co|Ltd|Corp|vs|No|etc|a\.m|p\.m|A\.M|P\.M|U\.S|e\.g|i\.e|sĩ|TS|BS)\.)(?<=[.!?]["”’)]?)\s+(?=[\p{Lu}\d"“‘(])/u;

export function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

// [số câu Anh, số câu Việt, phạt]
const MOVES: [number, number, number][] = [
  [1, 1, 0],
  [1, 2, 0.25],
  [2, 1, 0.25],
  [1, 3, 0.5],
  [3, 1, 0.5],
  [2, 2, 0.6],
  [1, 0, 1.2],
  [0, 1, 1.2],
];

/** Căn hai danh sách câu theo độ dài (lập trình động) */
export function alignSentences(en: string[], vi: string[]): { en: string; vi: string }[] {
  const n = en.length;
  const m = vi.length;
  if (!n || !m) return n || m ? [{ en: en.join(" "), vi: vi.join(" ") }] : [];
  const le = en.map((s) => s.length);
  const lv = vi.map((s) => s.length);
  const ratio = lv.reduce((a, b) => a + b, 0) / Math.max(1, le.reduce((a, b) => a + b, 0));
  const sum = (arr: number[], from: number, k: number) => arr.slice(from, from + k).reduce((a, b) => a + b, 0);

  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  const back: [number, number][][] = Array.from({ length: n + 1 }, () => new Array<[number, number]>(m + 1));
  cost[0][0] = 0;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (cost[i][j] === Infinity) continue;
      for (const [di, dj, penalty] of MOVES) {
        const ni = i + di;
        const nj = j + dj;
        if (ni > n || nj > m) continue;
        const a = sum(le, i, di) * ratio;
        const b = sum(lv, j, dj);
        const c = cost[i][j] + penalty + Math.abs(a - b) / (a + b + 1);
        if (c < cost[ni][nj]) {
          cost[ni][nj] = c;
          back[ni][nj] = [di, dj];
        }
      }
    }
  }
  const out: { en: string; vi: string }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const [di, dj] = back[i][j];
    out.push({ en: en.slice(i - di, i).join(" "), vi: vi.slice(j - dj, j).join(" ") });
    i -= di;
    j -= dj;
  }
  return out.reverse();
}

export function alignBilingual(en: string, vi: string): BilingualPair[] {
  const le = lines(en);
  const lv = lines(vi);
  const out: BilingualPair[] = [];
  const push = (pairs: { en: string; vi: string }[]) =>
    pairs.forEach((p, k) => out.push({ ...p, newParagraph: k === 0 }));

  if (le.length === lv.length) {
    le.forEach((line, i) => push(alignSentences(splitSentences(line), splitSentences(lv[i]))));
    return out;
  }
  // số dòng lệch: căn cả khối theo câu, đánh dấu đầu đoạn theo các dòng của bản gốc
  const se = le.map(splitSentences);
  const starts = new Set<string>(se.map((s) => s[0]).filter(Boolean));
  for (const p of alignSentences(se.flat(), lv.flatMap(splitSentences))) {
    out.push({ ...p, newParagraph: [...starts].some((s) => p.en.startsWith(s)) });
  }
  return out;
}
