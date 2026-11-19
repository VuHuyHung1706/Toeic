import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Attempt, Letter, PartNo, TestData } from "../types";

const DIR = path.join(process.cwd(), "content", "tests");

export function loadTest(id: string): TestData {
  return JSON.parse(readFileSync(path.join(DIR, `${id}.json`), "utf8")) as TestData;
}

export function allTests(): TestData[] {
  return readdirSync(DIR)
    .filter((f) => f.startsWith("20"))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as TestData);
}

/** Câu trả lời cho mọi câu của các part: "correct" | "wrong" | "skip" theo hàm chọn */
export function answersFor(test: TestData, pick: (n: number, answer: Letter) => Letter | null): Record<number, Letter> {
  const out: Record<number, Letter> = {};
  for (const p of test.parts)
    for (const g of p.groups)
      for (const q of g.questions) {
        const a = pick(q.number, q.answer!);
        if (a) out[q.number] = a;
      }
  return out;
}

export const wrongOf = (a: Letter): Letter => (a === "A" ? "B" : "A");

export function attempt(partial: Partial<Attempt> & { testId: string; answers: Record<number, Letter> }): Attempt {
  return {
    id: Math.random().toString(36).slice(2),
    testTitle: partial.testId,
    mode: "practice",
    parts: [1, 2, 3, 4, 5, 6, 7] as PartNo[],
    startedAt: 0,
    submittedAt: 0,
    durationSec: 0,
    byPart: {},
    correct: 0,
    total: 0,
    listeningCorrect: 0,
    readingCorrect: 0,
    ...partial,
  };
}
