// Kiểu dữ liệu khớp với JSON do scripts/etl.py sinh ra (content/tests/*.json)

export type Letter = "A" | "B" | "C" | "D";
export type PartNo = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface MediaRef {
  /** Đường dẫn tương đối trong thư mục Data/, vd "2025/test1/audio/x.mp3" */
  src: string | null;
  remoteUrl?: string | null;
}

export interface Question {
  number: number;
  part: PartNo;
  question: string;
  options: Partial<Record<Letter, string>>;
  answer: Letter | null;
  explanation: string;
  transcript?: string;
  /** Nhãn dạng câu (Part 2: loại câu hỏi, Part 5: chủ điểm ngữ pháp) — xem scripts/enrich.py */
  tags?: string[];
}

export interface Passage {
  en: string;
  vi: string;
}

export interface QuestionGroup {
  id: string;
  part: PartNo;
  questionNumbers: number[];
  audio: MediaRef | null;
  images: MediaRef[];
  passages: Passage[];
  questions: Question[];
  /** Part 3/4: từ vựng của đoạn (từ mục "Từ vựng" trong giải thích, hoặc tự lấy từ từ điển nếu vocabAuto) */
  vocab?: { term: string; pos: string[]; meaning: string }[];
  vocabAuto?: boolean;
}

export interface TestAvailability {
  fullTest: boolean;
  practiceListening: boolean;
  listeningGroupsMissingAudio: number;
  imagesMissing: number;
}

export interface TestSummary {
  id: string;
  year: number;
  collection: string;
  number: number;
  title: string;
  durationMinutes: number;
  questionCount: number;
  availability: TestAvailability;
}

export interface TestData extends TestSummary {
  fullAudio: MediaRef | null;
  parts: { part: PartNo; groups: QuestionGroup[] }[];
}

export type ExamMode = "full" | "practice";

export interface PartResult {
  correct: number;
  total: number;
}

export interface Attempt {
  id: string;
  testId: string;
  testTitle: string;
  mode: ExamMode;
  parts: PartNo[];
  answers: Record<number, Letter>;
  startedAt: number;
  submittedAt: number;
  durationSec: number;
  byPart: Partial<Record<PartNo, PartResult>>;
  correct: number;
  total: number;
  listeningCorrect: number;
  readingCorrect: number;
  /** Chỉ có ở chế độ thi thử full */
  listeningScore?: number;
  readingScore?: number;
  totalScore?: number;
}

// ---- ngân hàng câu theo dạng & từ vựng (scripts/enrich.py) ----
export interface BankTag {
  part: 2 | 5;
  tag: string;
  label: string;
  count: number;
  /** "testId:số câu:đáp án" */
  keys: string[];
}

export interface BankItem {
  testId: string;
  testTitle: string;
  group: QuestionGroup;
}

export interface VocabForm {
  w: string;
  pos: string[];
  meanings: string[];
}

export interface VocabEntry {
  /** Từ gốc */
  w: string;
  pos: string[];
  meanings: string[];
  /** Dạng khác của từ theo loại từ (submit → submission; last → lasting, lastly), kèm nghĩa */
  related: VocabForm[];
  /** Dạng chia của từ gốc (lasts, lasted…) — chỉ dùng để tô đậm trong câu ví dụ */
  inflections: string[];
  /** Từ cơ bản (A1–A2), ẩn mặc định */
  basic: boolean;
  /** Số đề có từ này */
  freq: number;
  /** Câu ví dụ Part 5 (đã điền đáp án) */
  examples: { text: string; testId: string; number: number }[];
  /** Câu ví dụ trong lời thoại Part 1–4 */
  listenExample?: { text: string; testId: string; number: number; part: number };
  /** Đề → số câu: r = phần đọc (Part 5–6), l = phần nghe (câu đầu của đoạn Part 1–4) */
  tests: Record<string, { r?: number[]; l?: number[] }>;
}
