import { describe, expect, it } from "vitest";
import { pageItems } from "./Pagination";

describe("pageItems", () => {
  it("hiện đủ khi ít trang", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("gần đầu: 1–5 … cuối", () => {
    expect(pageItems(1, 49)).toEqual([1, 2, 3, 4, 5, "…", 49]);
    expect(pageItems(4, 49)).toEqual([1, 2, 3, 4, 5, "…", 49]);
  });

  it("ở giữa: đầu … trước, hiện tại, sau … cuối", () => {
    expect(pageItems(20, 49)).toEqual([1, "…", 19, 20, 21, "…", 49]);
  });

  it("gần cuối: đầu … 5 trang cuối", () => {
    expect(pageItems(49, 49)).toEqual([1, "…", 45, 46, 47, 48, 49]);
    expect(pageItems(46, 49)).toEqual([1, "…", 45, 46, 47, 48, 49]);
  });

  it("luôn đủ 7 ô khi nhiều trang (thanh không co giật)", () => {
    expect(pageItems(5, 49)).toEqual([1, "…", 4, 5, 6, "…", 49]);
    for (let p = 1; p <= 49; p++) expect(pageItems(p, 49)).toHaveLength(7);
  });

  it("8 trang: vẫn 7 ô", () => {
    expect(pageItems(5, 8)).toEqual([1, "…", 4, 5, 6, 7, 8]);
    expect(pageItems(4, 8)).toEqual([1, 2, 3, 4, 5, "…", 8]);
  });
});
