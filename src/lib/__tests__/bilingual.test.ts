import { describe, expect, it } from "vitest";
import { alignBilingual, alignSentences, splitSentences } from "../bilingual";
import { allTests } from "./helpers";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

describe("splitSentences", () => {
  it("không tách sau từ viết tắt", () => {
    expect(splitSentences("Please call Dr. Miller at 3 P.M. today. Thanks!")).toEqual([
      "Please call Dr. Miller at 3 P.M. today.",
      "Thanks!",
    ]);
    expect(splitSentences("Tôi có hẹn với bác sĩ. Miller vào thứ Ba. Cảm ơn.")).toEqual(["Tôi có hẹn với bác sĩ. Miller vào thứ Ba.", "Cảm ơn."]);
  });
});

describe("alignSentences", () => {
  it("ghép 1–2 khi bản dịch tách một câu thành hai", () => {
    const r = alignSentences(
      ["I have an appointment with the doctor tomorrow morning.", "Thank you."],
      ["Tôi có một cuộc hẹn với bác sĩ.", "Vào sáng mai.", "Cảm ơn bạn."],
    );
    expect(r).toHaveLength(2);
    expect(r[0].vi).toBe("Tôi có một cuộc hẹn với bác sĩ. Vào sáng mai.");
    expect(r[1]).toEqual({ en: "Thank you.", vi: "Cảm ơn bạn." });
  });
});

describe("alignBilingual trên toàn bộ dữ liệu", () => {
  it("không làm mất hay lặp chữ nào của bản gốc và bản dịch", () => {
    let passages = 0;
    for (const t of allTests())
      for (const p of t.parts)
        for (const g of p.groups)
          for (const ps of g.passages) {
            if (!ps.en || !ps.vi) continue;
            passages++;
            const pairs = alignBilingual(ps.en, ps.vi);
            expect(norm(pairs.map((x) => x.en).join(" "))).toBe(norm(ps.en));
            expect(norm(pairs.map((x) => x.vi).join(" "))).toBe(norm(ps.vi));
            expect(pairs[0].newParagraph).toBe(true);
          }
    expect(passages).toBeGreaterThan(2000);
  });
});
