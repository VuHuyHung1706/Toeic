import type { Attempt, ExamMode, Letter, PartNo, PartResult, QuestionGroup, TestData } from "./types";

export const PARTS: { part: PartNo; name: string; skill: "listening" | "reading"; count: number; desc: string }[] = [
  { part: 1, name: "Mô tả tranh", skill: "listening", count: 6, desc: "Nghe 4 câu mô tả, chọn câu đúng với bức tranh" },
  { part: 2, name: "Hỏi – đáp", skill: "listening", count: 25, desc: "Nghe câu hỏi và chọn câu trả lời phù hợp" },
  { part: 3, name: "Đoạn hội thoại", skill: "listening", count: 39, desc: "13 đoạn hội thoại, mỗi đoạn 3 câu hỏi" },
  { part: 4, name: "Bài nói ngắn", skill: "listening", count: 30, desc: "10 bài nói, mỗi bài 3 câu hỏi" },
  { part: 5, name: "Hoàn thành câu", skill: "reading", count: 30, desc: "Chọn từ/cụm từ điền vào chỗ trống" },
  { part: 6, name: "Hoàn thành đoạn văn", skill: "reading", count: 16, desc: "4 đoạn văn, mỗi đoạn 4 chỗ trống" },
  { part: 7, name: "Đọc hiểu", skill: "reading", count: 54, desc: "Đoạn đơn, đoạn kép và đoạn ba" },
];

export const LISTENING_PARTS: PartNo[] = [1, 2, 3, 4];

export function partInfo(p: PartNo) {
  return PARTS[p - 1];
}

export function optionLetters(part: PartNo): Letter[] {
  return part === 2 ? ["A", "B", "C"] : ["A", "B", "C", "D"];
}

/** Đường dẫn phát media. Đổi NEXT_PUBLIC_MEDIA_BASE để trỏ sang CDN (R2/S3). */
export function mediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE ?? "/media";
  return `${base}/${src.split("/").map(encodeURIComponent).join("/")}`;
}

export function groupsForParts(test: TestData, parts: PartNo[]): QuestionGroup[] {
  return test.parts.filter((p) => parts.includes(p.part)).flatMap((p) => p.groups);
}

// ---------------------------------------------------------------------------
// Quy đổi điểm. ETS không công bố bảng chính thức — đây là bảng ước lượng
// phổ biến (số câu đúng → điểm), chỉ dùng để tham khảo.
// ---------------------------------------------------------------------------
// prettier-ignore
const LISTENING_TABLE = [
  5,5,5,5,5,5,5,10,15,20, 25,30,35,40,45,50,55,60,65,70, 75,80,85,90,95,100,110,115,120,125,
  130,135,140,145,150,160,165,170,175,180, 185,190,195,200,210,215,220,230,240,245, 250,255,260,270,275,280,290,295,300,310,
  315,320,325,330,340,345,350,360,365,370, 380,385,390,395,400,405,410,420,425,430, 440,445,450,460,465,470,475,480,485,490,
  495,495,495,495,495,495,495,495,495,495,495,
];
// prettier-ignore
const READING_TABLE = [
  5,5,5,5,5,5,5,5,5,5, 10,15,20,25,30,35,40,45,50,55, 60,65,70,75,80,85,90,95,100,105,
  110,115,120,125,130,135,140,145,150,155, 160,165,170,175,180,190,195,200,205,210, 215,220,225,230,235,240,250,255,260,265,
  270,280,285,290,300,305,310,315,320,325, 330,335,340,345,350,355,360,365,370,375, 385,390,395,400,405,410,415,420,425,430,
  435,445,450,455,465,470,480,485,490,495,495,
];

export function scaledListening(correct: number) {
  return LISTENING_TABLE[Math.max(0, Math.min(100, correct))];
}
export function scaledReading(correct: number) {
  return READING_TABLE[Math.max(0, Math.min(100, correct))];
}

export function gradeAttempt(params: {
  test: TestData;
  mode: ExamMode;
  parts: PartNo[];
  answers: Record<number, Letter>;
  startedAt: number;
  durationSec: number;
}): Attempt {
  const { test, mode, parts, answers, startedAt, durationSec } = params;
  const byPart: Partial<Record<PartNo, PartResult>> = {};
  let listeningCorrect = 0;
  let readingCorrect = 0;
  for (const g of groupsForParts(test, parts)) {
    for (const q of g.questions) {
      const r = (byPart[q.part] ??= { correct: 0, total: 0 });
      r.total += 1;
      if (q.answer && answers[q.number] === q.answer) {
        r.correct += 1;
        if (q.part <= 4) listeningCorrect += 1;
        else readingCorrect += 1;
      }
    }
  }
  const total = Object.values(byPart).reduce((s, r) => s + (r?.total ?? 0), 0);
  const attempt: Attempt = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    testId: test.id,
    testTitle: test.title,
    mode,
    parts,
    answers,
    startedAt,
    submittedAt: Date.now(),
    durationSec,
    byPart,
    correct: listeningCorrect + readingCorrect,
    total,
    listeningCorrect,
    readingCorrect,
  };
  if (mode === "full") {
    attempt.listeningScore = scaledListening(listeningCorrect);
    attempt.readingScore = scaledReading(readingCorrect);
    attempt.totalScore = attempt.listeningScore + attempt.readingScore;
  }
  return attempt;
}

export function formatDuration(sec: number) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function parsePartsParam(v: string | null): PartNo[] {
  const parts = (v ?? "")
    .split(",")
    .map((x) => Number(x))
    .filter((n): n is PartNo => Number.isInteger(n) && n >= 1 && n <= 7);
  return [...new Set(parts)].sort() as PartNo[];
}
