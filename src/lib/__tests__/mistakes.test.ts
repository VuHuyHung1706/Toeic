import { describe, expect, it } from "vitest";
import { computeMistakes, mistakeTestIds } from "../mistakes";
import { bankKeyStatus, latestOutcomes } from "../outcomes";
import type { ReviewLog } from "../storage";
import { attempt, loadTest, wrongOf } from "./helpers";

const DAY = 86_400_000;
const test = loadTest("2025-test1");
const tests = { [test.id]: test };
const q101 = test.parts[4].groups[0].questions[0]; // Part 5, câu 101
const T0 = Date.UTC(2026, 0, 1);

const wrongAttempt = attempt({ testId: test.id, parts: [5], answers: { 101: wrongOf(q101.answer!) }, submittedAt: T0 });

describe("computeMistakes", () => {
  it("câu sai trong bài làm → đang sai; câu bỏ trống chỉ tính khi bật tuỳ chọn", () => {
    const items = computeMistakes([wrongAttempt], {}, tests, false, T0);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ number: 101, status: "wrong", wrongCount: 1, inAttempt: true });
    expect(computeMistakes([wrongAttempt], {}, tests, true, T0).length).toBe(30); // 29 câu bỏ trống còn lại
  });

  it("làm đúng lại → hẹn ôn 1 ngày → 3 ngày → đã thuộc", () => {
    const k = `${test.id}:101`;
    const r1: ReviewLog = { [k]: [{ at: T0 + 1000, ok: true }] };
    let it1 = computeMistakes([wrongAttempt], r1, tests, false, T0 + 2000)[0];
    expect(it1.status).toBe("scheduled");
    expect(it1.nextDue).toBe(T0 + 1000 + DAY);
    it1 = computeMistakes([wrongAttempt], r1, tests, false, T0 + 1000 + DAY)[0];
    expect(it1.status).toBe("due");

    const r2: ReviewLog = { [k]: [{ at: T0 + 1000, ok: true }, { at: T0 + 2 * DAY, ok: true }] };
    const it2 = computeMistakes([wrongAttempt], r2, tests, false, T0 + 2 * DAY + 1)[0];
    expect(it2).toMatchObject({ status: "scheduled", streak: 2, nextDue: T0 + 2 * DAY + 3 * DAY });

    const r3: ReviewLog = { [k]: [...r2[k], { at: T0 + 6 * DAY, ok: true }] };
    expect(computeMistakes([wrongAttempt], r3, tests, false, T0 + 7 * DAY)[0].status).toBe("mastered");

    const r4: ReviewLog = { [k]: [...r3[k], { at: T0 + 8 * DAY, ok: false }] };
    expect(computeMistakes([wrongAttempt], r4, tests, false, T0 + 9 * DAY)[0]).toMatchObject({ status: "wrong", streak: 0, wrongCount: 2 });
  });

  it("câu chỉ sai khi luyện theo dạng (không có trong bài làm) vẫn vào sổ", () => {
    const reviews: ReviewLog = { [`${test.id}:120`]: [{ at: T0, ok: false }] };
    expect(mistakeTestIds([], reviews)).toEqual([test.id]);
    const items = computeMistakes([], reviews, tests, false, T0);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ number: 120, part: 5, inAttempt: false, status: "wrong" });
  });

  it("câu luôn làm đúng thì không vào sổ", () => {
    const ok = attempt({ testId: test.id, parts: [5], answers: { 101: q101.answer! }, submittedAt: T0 });
    expect(computeMistakes([ok], {}, tests, false, T0)).toHaveLength(0);
  });
});

describe("outcomes", () => {
  it("lấy kết quả mới nhất giữa bài làm và lần luyện lại", () => {
    const k = `${test.id}:101`;
    const outcomes = latestOutcomes([wrongAttempt], { [k]: [{ at: T0 + 5, ok: true }] });
    expect(bankKeyStatus(`${k}:${q101.answer}`, outcomes)).toBe("correct");
    expect(bankKeyStatus(`${k}:${q101.answer}`, latestOutcomes([wrongAttempt], {}))).toBe("wrong");
    expect(bankKeyStatus(`${test.id}:102:A`, outcomes)).toBe("new");
  });
});
