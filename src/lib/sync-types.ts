// Kiểu dữ liệu đồng bộ giữa trình duyệt và server (dùng chung client/server, không có mã chạy).
import type { Attempt } from "./types";

export interface ReviewEvent {
  at: number;
  ok: boolean;
}
export type ReviewLog = Record<string, ReviewEvent[]>;

export interface DictationEvent {
  at: number;
  testId: string;
  groupId: string;
  correct: number;
  total: number;
}

export interface VocabCard {
  /** 1..VOCAB_INTERVALS.length; vượt quá = đã thuộc */
  box: number;
  due: number;
  lastAt: number;
  reviews: number;
  lapses: number;
}

export interface Progress {
  answers: Record<number, string>;
  flagged: number[];
  elapsedSec: number;
  groupIndex: number;
  audioTime?: number;
  startedAt: number;
}

/** Toàn bộ dữ liệu học của một người — cùng hình dạng với các khoá trong localStorage */
export interface UserSnapshot {
  attempts: Attempt[];
  reviews: ReviewLog;
  dictation: DictationEvent[];
  vocab: Record<string, VocabCard>;
  vocabLog: Record<string, number>;
  prefs: Record<string, string>;
  progress: Record<string, Progress>;
}

/** Một thay đổi nhỏ, idempotent (gửi lại nhiều lần vẫn cho cùng kết quả) */
export type SyncOp =
  | { t: "attempt.put"; a: Attempt }
  | { t: "attempt.del"; id: string }
  | { t: "review.add"; key: string; at: number; ok: boolean }
  | { t: "dictation.add"; e: DictationEvent }
  | { t: "vocab.put"; word: string; card: VocabCard }
  | { t: "vocab.del"; word: string }
  /** số thẻ đã ôn trong ngày — server giữ giá trị lớn hơn */
  | { t: "vocabDay.put"; day: string; count: number }
  | { t: "pref.put"; key: string; value: string }
  | { t: "progress.put"; key: string; data: Progress }
  | { t: "progress.del"; key: string };

export const SNAPSHOT_LIMITS = { attempts: 300, dictation: 1000, reviewsPerQuestion: 20 } as const;
export const MAX_OPS_PER_REQUEST = 200;

/** Khoá để gộp các thao tác cùng một đối tượng (thao tác sau thắng); null = không gộp */
export function opIdentity(op: SyncOp): string | null {
  switch (op.t) {
    case "attempt.put":
      return `attempt:${op.a.id}`;
    case "attempt.del":
      return `attempt:${op.id}`;
    case "vocab.put":
    case "vocab.del":
      return `vocab:${op.word}`;
    case "vocabDay.put":
      return `vocabDay:${op.day}`;
    case "pref.put":
      return `pref:${op.key}`;
    case "progress.put":
    case "progress.del":
      return `progress:${op.key}`;
    default:
      return null;
  }
}

/** Gộp hàng đợi: với mỗi đối tượng chỉ giữ thao tác cuối (vocabDay giữ số lớn nhất), giữ thứ tự xuất hiện. */
export function coalesceOps(ops: SyncOp[]): SyncOp[] {
  const last = new Map<string, number>();
  ops.forEach((op, i) => {
    const id = opIdentity(op);
    if (id) last.set(id, i);
  });
  const out: SyncOp[] = [];
  ops.forEach((op, i) => {
    const id = opIdentity(op);
    if (id && last.get(id) !== i) return;
    if (op.t === "vocabDay.put") {
      const max = Math.max(...ops.filter((o) => o.t === "vocabDay.put" && o.day === op.day).map((o) => (o as typeof op).count));
      out.push({ ...op, count: max });
    } else out.push(op);
  });
  return out;
}

/** Chuyển toàn bộ dữ liệu (vd của khách trên trình duyệt) thành các thao tác để đưa lên tài khoản */
export function snapshotToOps(s: UserSnapshot): SyncOp[] {
  const ops: SyncOp[] = [];
  for (const a of s.attempts) ops.push({ t: "attempt.put", a });
  for (const [key, events] of Object.entries(s.reviews))
    for (const e of events) ops.push({ t: "review.add", key, at: e.at, ok: e.ok });
  for (const e of s.dictation) ops.push({ t: "dictation.add", e });
  for (const [word, card] of Object.entries(s.vocab)) ops.push({ t: "vocab.put", word, card });
  for (const [day, count] of Object.entries(s.vocabLog)) ops.push({ t: "vocabDay.put", day, count });
  for (const [key, value] of Object.entries(s.prefs)) ops.push({ t: "pref.put", key, value });
  for (const [key, data] of Object.entries(s.progress)) ops.push({ t: "progress.put", key, data });
  return ops;
}

/** Có dữ liệu học đáng chuyển không (bỏ qua tuỳ chọn hiển thị) */
export function snapshotCounts(s: UserSnapshot) {
  return {
    attempts: s.attempts.length,
    reviews: Object.values(s.reviews).reduce((n, e) => n + e.length, 0),
    vocab: Object.keys(s.vocab).length,
    dictation: s.dictation.length,
    progress: Object.keys(s.progress).length,
  };
}
