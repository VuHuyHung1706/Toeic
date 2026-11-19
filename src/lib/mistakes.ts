// Tính "sổ câu sai" từ lịch sử bài làm + các lần làm lại
import { groupsForParts } from "./toeic";
import { questionKey, type ReviewLog } from "./storage";
import type { Attempt, Letter, PartNo, QuestionGroup, TestData } from "./types";

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
  answer: Letter | null;
  wrongCount: number;
  /** true = lần gần nhất vẫn sai/bỏ trống; false = đã làm đúng lại */
  active: boolean;
}

interface Ev {
  at: number;
  ok: boolean;
  selected: Letter | null;
  skipped: boolean;
}

export function computeMistakes(
  attempts: Attempt[],
  reviews: ReviewLog,
  tests: Record<string, TestData>,
  includeSkipped: boolean,
): MistakeItem[] {
  const events = new Map<string, { ev: Ev[]; test: TestData; group: QuestionGroup; part: PartNo; number: number; answer: Letter | null }>();

  for (const a of attempts) {
    const test = tests[a.testId];
    if (!test) continue;
    for (const g of groupsForParts(test, a.parts)) {
      for (const q of g.questions) {
        const sel = a.answers[q.number] ?? null;
        if (!sel && !includeSkipped) continue;
        const key = questionKey(test.id, q.number);
        const entry = events.get(key) ?? { ev: [], test, group: g, part: q.part, number: q.number, answer: q.answer };
        entry.ev.push({ at: a.submittedAt, ok: !!sel && sel === q.answer, selected: sel, skipped: !sel });
        events.set(key, entry);
      }
    }
  }
  for (const [key, list] of Object.entries(reviews)) {
    const entry = events.get(key);
    if (!entry) continue;
    for (const r of list) entry.ev.push({ at: r.at, ok: r.ok, selected: null, skipped: false });
  }

  const out: MistakeItem[] = [];
  for (const [key, e] of events) {
    const wrongCount = e.ev.filter((x) => !x.ok).length;
    if (!wrongCount) continue;
    e.ev.sort((x, y) => x.at - y.at);
    const last = e.ev[e.ev.length - 1];
    const lastFromAttempt = [...e.ev].reverse().find((x) => x.selected !== null || x.skipped);
    out.push({
      key,
      testId: e.test.id,
      testTitle: e.test.title,
      number: e.number,
      part: e.part,
      groupId: e.group.id,
      lastAt: last.at,
      lastSelected: lastFromAttempt?.selected ?? null,
      answer: e.answer,
      wrongCount,
      active: !last.ok,
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
