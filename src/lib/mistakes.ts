// Sổ câu sai + lịch ôn ngắt quãng
//
// Mỗi câu từng làm sai có một chuỗi sự kiện (bài làm, lần luyện lại). Sau khi làm đúng lại,
// câu được hẹn ôn tiếp sau 1 → 3 → 7 ngày; đúng liên tiếp MASTER_STREAK lần thì coi là đã thuộc.
// Làm sai ở bất kỳ lần nào sẽ đưa câu về lại "cần ôn".
import { groupsForParts } from "./toeic";
import { questionKey, type ReviewLog } from "./storage";
import type { Attempt, Letter, PartNo, Question, QuestionGroup, TestData } from "./types";

const DAY = 86_400_000;
/** Khoảng cách ôn (ngày) sau 1, 2 lần đúng liên tiếp */
export const REVIEW_INTERVALS = [1, 3, 7];
export const MASTER_STREAK = 3;

export type MistakeStatus = "wrong" | "due" | "scheduled" | "mastered";

export interface MistakeItem {
  key: string;
  testId: string;
  testTitle: string;
  number: number;
  part: PartNo;
  groupId: string;
  /** Lần gần nhất làm câu này */
  lastAt: number;
  lastSelected: Letter | null;
  /** false = câu chỉ xuất hiện khi luyện theo dạng / luyện lại, chưa có trong bài làm nào */
  inAttempt: boolean;
  answer: Letter | null;
  wrongCount: number;
  /** Số lần đúng liên tiếp gần nhất */
  streak: number;
  status: MistakeStatus;
  /** Thời điểm đến hạn ôn (status = scheduled/due) */
  nextDue: number | null;
}

interface Ev {
  at: number;
  ok: boolean;
  selected: Letter | null;
  fromAttempt: boolean;
}

interface Entry {
  ev: Ev[];
  test: TestData;
  group: QuestionGroup;
  q: Question;
}

function findQuestion(test: TestData, n: number): { group: QuestionGroup; q: Question } | null {
  for (const p of test.parts)
    for (const g of p.groups)
      for (const q of g.questions) if (q.number === n) return { group: g, q };
  return null;
}

/** Các đề cần tải để tính sổ câu sai */
export function mistakeTestIds(attempts: Attempt[], reviews: ReviewLog): string[] {
  const ids = new Set(attempts.map((a) => a.testId));
  for (const k of Object.keys(reviews)) ids.add(k.slice(0, k.lastIndexOf(":")));
  return [...ids];
}

export function computeMistakes(
  attempts: Attempt[],
  reviews: ReviewLog,
  tests: Record<string, TestData>,
  includeSkipped: boolean,
  now: number,
): MistakeItem[] {
  const entries = new Map<string, Entry>();

  for (const a of attempts) {
    const test = tests[a.testId];
    if (!test) continue;
    for (const g of groupsForParts(test, a.parts)) {
      for (const q of g.questions) {
        const sel = a.answers[q.number] ?? null;
        if (!sel && !includeSkipped) continue;
        const key = questionKey(test.id, q.number);
        const e = entries.get(key) ?? { ev: [], test, group: g, q };
        e.ev.push({ at: a.submittedAt, ok: !!sel && sel === q.answer, selected: sel, fromAttempt: true });
        entries.set(key, e);
      }
    }
  }
  // lần luyện lại (sổ câu sai, luyện theo dạng) — có thể là câu chưa từng xuất hiện trong bài làm nào
  for (const [key, list] of Object.entries(reviews)) {
    let e = entries.get(key);
    if (!e) {
      const i = key.lastIndexOf(":");
      const test = tests[key.slice(0, i)];
      const found = test && findQuestion(test, Number(key.slice(i + 1)));
      if (!found) continue;
      e = { ev: [], test, group: found.group, q: found.q };
      entries.set(key, e);
    }
    for (const r of list) e.ev.push({ at: r.at, ok: r.ok, selected: null, fromAttempt: false });
  }

  const out: MistakeItem[] = [];
  for (const [key, e] of entries) {
    const wrongCount = e.ev.filter((x) => !x.ok).length;
    if (!wrongCount) continue;
    e.ev.sort((x, y) => x.at - y.at);
    const last = e.ev[e.ev.length - 1];
    let streak = 0;
    for (let i = e.ev.length - 1; i >= 0 && e.ev[i].ok; i--) streak++;

    let status: MistakeStatus;
    let nextDue: number | null = null;
    if (!last.ok) status = "wrong";
    else if (streak >= MASTER_STREAK) status = "mastered";
    else {
      nextDue = last.at + REVIEW_INTERVALS[Math.min(streak, REVIEW_INTERVALS.length) - 1] * DAY;
      status = now >= nextDue ? "due" : "scheduled";
    }
    const lastAttempt = [...e.ev].reverse().find((x) => x.fromAttempt);
    out.push({
      key,
      testId: e.test.id,
      testTitle: e.test.title,
      number: e.q.number,
      part: e.q.part,
      groupId: e.group.id,
      lastAt: last.at,
      lastSelected: lastAttempt?.selected ?? null,
      inAttempt: !!lastAttempt,
      answer: e.q.answer,
      wrongCount,
      streak,
      status,
      nextDue,
    });
  }
  return out.sort((a, b) => b.lastAt - a.lastAt || a.testId.localeCompare(b.testId) || a.number - b.number);
}

/** Các nhóm câu (theo thứ tự đề → số câu) chứa câu sai, kèm đề của nhóm */
export function groupsOfMistakes(items: MistakeItem[], tests: Record<string, TestData>) {
  const wanted = new Set(items.map((i) => i.groupId));
  const out: { test: TestData; group: QuestionGroup }[] = [];
  const testIds = [...new Set(items.map((i) => i.testId))].sort();
  for (const id of testIds) {
    const test = tests[id];
    if (!test) continue;
    for (const p of test.parts) for (const g of p.groups) if (wanted.has(g.id)) out.push({ test, group: g });
  }
  return out;
}
