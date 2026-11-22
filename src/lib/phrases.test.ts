import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findPhrase } from "./phrases";
import type { PhraseGroup } from "./types";

describe("findPhrase — tô cụm trong câu ví dụ", () => {
  it.each([
    ["access to", "Residents have access to an outdoor pool.", "access to"],
    ["add A to B", "Just add your name to the sign-up sheet.", "add your name to"],
    ["apply for", "She applied for the position last week.", "applied for"],
    ["at no cost / charge", "Repairs are provided at no charge.", "at no charge"],
    ["at your (earliest) convenience", "Please reply at your convenience.", "at your convenience"],
    ["at your (earliest) convenience", "Please reply at your earliest convenience.", "at your earliest convenience"],
    ["in the event of / that", "In the event of rain, the picnic will move indoors.", "In the event of"],
    ["provide A with B", "We provide guests with free parking.", "provide guests with"],
  ])("%s", (phrase, example, hit) => {
    expect(findPhrase(example, phrase)?.[1]).toBe(hit);
  });

  it("không tìm thấy thì trả về null", () => {
    expect(findPhrase("Nothing related here.", "access to")).toBeNull();
  });

  it("phần lớn câu ví dụ trong dữ liệu tìm thấy cụm", () => {
    const groups = (JSON.parse(readFileSync("content/phrases.json", "utf8")) as { groups: PhraseGroup[] }).groups;
    const items = groups.flatMap((g) => g.items);
    const found = items.filter((it) => findPhrase(it.example, it.phrase)).length;
    expect(items.length).toBe(465);
    expect(found / items.length).toBeGreaterThan(0.85);
  });
});
