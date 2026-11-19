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
