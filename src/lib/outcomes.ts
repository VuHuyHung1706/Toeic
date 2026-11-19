// Kết quả gần nhất của từng câu ("testId:số câu"), gộp từ bài làm và các lần luyện lại
import type { ReviewLog } from "./storage";
import type { Attempt, Letter } from "./types";

export interface Outcome {
  at: number;
  /** Đáp án đã chọn (null nếu là lần luyện lại không lưu lựa chọn) */
  selected: Letter | null;
  /** Chỉ có với lần luyện lại; với bài làm thì so sánh selected với đáp án */
  ok?: boolean;
}

export function latestOutcomes(attempts: Attempt[], reviews: ReviewLog): Map<string, Outcome> {
  const m = new Map<string, Outcome>();
  const put = (key: string, o: Outcome) => {
    const cur = m.get(key);
    if (!cur || o.at >= cur.at) m.set(key, o);
  };
  for (const a of attempts) {
    for (const [n, sel] of Object.entries(a.answers)) put(`${a.testId}:${n}`, { at: a.submittedAt, selected: sel });
  }
  for (const [key, list] of Object.entries(reviews)) {
    const last = list[list.length - 1];
    if (last) put(key, { at: last.at, selected: null, ok: last.ok });
  }
  return m;
}

/** "testId:số câu:đáp án" → đúng / sai / chưa làm */
export function bankKeyStatus(bankKey: string, outcomes: Map<string, Outcome>): "correct" | "wrong" | "new" {
  const i = bankKey.lastIndexOf(":");
  const key = bankKey.slice(0, i);
  const answer = bankKey.slice(i + 1);
  const o = outcomes.get(key);
  if (!o) return "new";
  const ok = o.ok ?? o.selected === answer;
  return ok ? "correct" : "wrong";
}
