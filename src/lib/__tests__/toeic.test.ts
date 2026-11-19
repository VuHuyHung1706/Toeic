import { describe, expect, it } from "vitest";
import {
  formatDuration,
  gradeAttempt,
  groupsForParts,
  mediaUrl,
  parsePartsParam,
  predictScore,
  scaledListening,
  scaledReading,
} from "../toeic";
import type { Attempt, PartNo } from "../types";
import { answersFor, loadTest, wrongOf } from "./helpers";

const ALL: PartNo[] = [1, 2, 3, 4, 5, 6, 7];

describe("bảng quy đổi điểm", () => {
  it("đi từ 5 tới 495, không giảm, chặn ngoài khoảng 0–100", () => {
    for (const f of [scaledListening, scaledReading]) {
      expect(f(0)).toBe(5);
      expect(f(100)).toBe(495);
      expect(f(-3)).toBe(5);
      expect(f(150)).toBe(495);
      for (let i = 1; i <= 100; i++) expect(f(i)).toBeGreaterThanOrEqual(f(i - 1));
    }
  });
});

describe("gradeAttempt", () => {
  const test = loadTest("2025-test1");

  it("đúng hết → 990, mỗi part đúng đủ số câu", () => {
    const a = gradeAttempt({ test, mode: "full", parts: ALL, answers: answersFor(test, (_, ans) => ans), startedAt: 0, durationSec: 60 });
    expect(a.total).toBe(200);
    expect(a.correct).toBe(200);
    expect(a.listeningCorrect).toBe(100);
    expect(a.readingCorrect).toBe(100);
    expect(a.totalScore).toBe(990);
    expect(a.byPart).toMatchObject({ 1: { correct: 6, total: 6 }, 2: { correct: 25, total: 25 }, 7: { correct: 54, total: 54 } });
  });

  it("sai hết hoặc bỏ trống → 10 điểm", () => {
    const wrong = gradeAttempt({ test, mode: "full", parts: ALL, answers: answersFor(test, (_, ans) => wrongOf(ans)), startedAt: 0, durationSec: 0 });
    expect(wrong.correct).toBe(0);
    expect(wrong.totalScore).toBe(10);
    const empty = gradeAttempt({ test, mode: "full", parts: ALL, answers: {}, startedAt: 0, durationSec: 0 });
    expect(empty.totalScore).toBe(10);
  });

  it("luyện tập: chỉ tính các part đã chọn, không quy đổi 990", () => {
    const a = gradeAttempt({ test, mode: "practice", parts: [5], answers: answersFor(test, (n, ans) => (n % 2 ? ans : null)), startedAt: 0, durationSec: 0 });
    expect(a.total).toBe(30);
    expect(a.correct).toBe(15);
    expect(a.listeningCorrect).toBe(0);
    expect(a.totalScore).toBeUndefined();
    expect(Object.keys(a.byPart)).toEqual(["5"]);
  });

  it("groupsForParts giữ đúng thứ tự và số câu", () => {
    const g = groupsForParts(test, [3, 1]);
    expect(g[0].part).toBe(1);
    expect(g.reduce((s, x) => s + x.questions.length, 0)).toBe(45);
  });
});

describe("tiện ích", () => {
  it("parsePartsParam lọc giá trị lạ, bỏ trùng, sắp xếp", () => {
    expect(parsePartsParam("7,1,3,3,9,x,0")).toEqual([1, 3, 7]);
    expect(parsePartsParam(null)).toEqual([]);
  });
  it("formatDuration", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(7200)).toBe("2:00:00");
    expect(formatDuration(-5)).toBe("00:00");
  });
  it("mediaUrl mã hoá từng đoạn đường dẫn", () => {
    expect(mediaUrl("2026/test1/image/im191-195 (2) test1-p7.png")).toBe("/media/2026/test1/image/im191-195%20(2)%20test1-p7.png");
    expect(mediaUrl(null)).toBeNull();
  });
});

describe("predictScore", () => {
  const now = Date.UTC(2026, 10, 19);
  const base = { id: "x", testId: "t", testTitle: "t", mode: "practice" as const, parts: [], answers: {}, startedAt: 0, durationSec: 0, correct: 0, total: 0, listeningCorrect: 0, readingCorrect: 0 };

  it("chưa đủ dữ liệu → null", () => {
    const p = predictScore([{ ...base, submittedAt: now, byPart: { 5: { correct: 5, total: 10 } } } as Attempt], now);
    expect(p.listening).toBeNull();
    expect(p.reading).toBeNull();
    expect(p.total).toBeNull();
  });

  it("tính theo tỉ lệ từng part × số câu thật, part thiếu dùng tỉ lệ chung", () => {
    const a = {
      ...base,
      submittedAt: now - 3600e3,
      byPart: { 1: { correct: 5, total: 6 }, 2: { correct: 20, total: 25 }, 3: { correct: 26, total: 39 }, 5: { correct: 21, total: 30 }, 6: { correct: 1, total: 16 } },
    } as Attempt;
    const p = predictScore([a], now);
    expect(p.listening?.expectedCorrect).toBe(73);
    expect(p.listening?.estimatedParts).toEqual([4]);
    expect(p.listening?.score).toBe(scaledListening(73));
    expect(p.reading?.expectedCorrect).toBe(48);
    expect(p.total).toBe(scaledListening(73) + scaledReading(48));
  });

  it("bỏ qua bài làm cũ hơn 60 ngày", () => {
    const old = { ...base, submittedAt: now - 61 * 86400e3, byPart: { 5: { correct: 30, total: 30 } } } as Attempt;
    expect(predictScore([old], now).reading).toBeNull();
  });
});
