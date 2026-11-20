import { describe, expect, it } from "vitest";
import { directionsPartAt, hasAudioTimeline, listeningIndexAt } from "@/lib/cbt";
import type { PartNo, QuestionGroup } from "@/lib/types";

const g = (id: string, part: PartNo, audioStart?: number, audioEnd?: number): QuestionGroup => ({
  id,
  part,
  questionNumbers: [1],
  audio: null,
  images: [],
  passages: [],
  questions: [],
  audioStart,
  audioEnd,
});

// Part 1 câu 1–2, rồi hướng dẫn Part 2 (30 s), Part 2 câu 7
const L = [g("p1-1", 1, 97, 116), g("p1-2", 1, 121, 143), g("p2-1", 2, 175, 190)];

describe("đồng bộ audio thi thật", () => {
  it("hasAudioTimeline: chỉ bật khi mọi nhóm nghe có mốc", () => {
    expect(hasAudioTimeline([...L, g("p5", 5)])).toBe(true);
    expect(hasAudioTimeline([g("a", 1, 1, 2), g("b", 1)])).toBe(false);
    expect(hasAudioTimeline([g("p5", 5)])).toBe(false);
  });

  it("listeningIndexAt: nhóm audio đang đọc", () => {
    expect(listeningIndexAt(L, 0)).toBe(-1);
    expect(listeningIndexAt(L, 96.9)).toBe(0); // sớm 0,25 s cho kịp hiện câu
    expect(listeningIndexAt(L, 118)).toBe(0); // khoảng lặng giữa hai câu: giữ câu trước
    expect(listeningIndexAt(L, 121)).toBe(1);
    expect(listeningIndexAt(L, 3000)).toBe(2);
  });

  it("directionsPartAt: hướng dẫn đầu bài và giữa các part", () => {
    expect(directionsPartAt(L, 10)).toBe(1);
    expect(directionsPartAt(L, 100)).toBeNull();
    expect(directionsPartAt(L, 118)).toBeNull(); // cùng part → không phải hướng dẫn
    expect(directionsPartAt(L, 150)).toBe(2); // hết Part 1, chưa tới Part 2
    expect(directionsPartAt(L, 180)).toBeNull();
    expect(directionsPartAt([], 5)).toBeNull();
  });
});
