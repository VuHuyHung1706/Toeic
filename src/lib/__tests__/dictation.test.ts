import { describe, expect, it } from "vitest";
import { buildTokens, diffWords, hintOf, normalizeWord, scriptLines } from "../dictation";
import { loadTest } from "./helpers";

describe("diffWords", () => {
  it("bỏ qua chữ hoa và dấu câu", () => {
    const r = diffWords("Hey, Oliver. Did you see it?", "hey oliver did you see it");
    expect(r.correct).toBe(r.total);
    expect(r.ops.every((o) => o.type === "ok")).toBe(true);
  });
  it("đánh dấu từ thiếu và từ thừa", () => {
    const r = diffWords("the focus group results", "the focus result group");
    expect(r.total).toBe(4);
    expect(r.correct).toBe(3);
    expect(r.ops.filter((o) => o.type === "miss").map((o) => o.text)).toEqual(["results"]);
    expect(r.ops.filter((o) => o.type === "extra").map((o) => o.text)).toEqual(["result"]);
  });
  it("chưa gõ gì → 0 điểm", () => {
    expect(diffWords("one two three", "").correct).toBe(0);
  });
});

describe("điền từ", () => {
  const group = loadTest("2025-test1").parts[2].groups[0];
  it("tách nhãn người nói khỏi lời thoại", () => {
    const lines = scriptLines(group);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => !/^[WM]-[A-Za-z]{2}\b/.test(l.text))).toBe(true);
    expect(lines[0].label).toMatch(/^[WMwm]-/);
  });
  it("cùng seed → cùng chỗ trống; độ khó cao → nhiều chỗ trống hơn", () => {
    const lines = scriptLines(group);
    const count = (lv: "easy" | "medium" | "hard", seed: number) => buildTokens(lines, lv, seed).flat().filter((t) => t.kind === "blank").length;
    expect(count("medium", 3)).toBe(count("medium", 3));
    expect(count("hard", 3)).toBeGreaterThan(count("easy", 3));
    const blanks = buildTokens(lines, "hard", 1).flat().filter((t) => t.kind === "blank");
    expect(blanks.every((b) => b.kind === "blank" && b.answer.length >= 3)).toBe(true);
    expect(blanks.map((b) => (b.kind === "blank" ? b.id : -1))).toEqual(blanks.map((_, i) => i));
  });
  it("normalizeWord & hintOf", () => {
    expect(normalizeWord(" Company’s, ")).toBe("company's");
    expect(hintOf("Hello, world!")).toBe("H____, w____!");
  });
});
