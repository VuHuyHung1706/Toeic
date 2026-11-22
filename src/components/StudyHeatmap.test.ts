import { describe, expect, it } from "vitest";
import { heatLevel } from "./StudyHeatmap";

describe("heatLevel", () => {
  it("theo ngưỡng cố định 1–10 / 11–30 / 31–60 / trên 60", () => {
    expect([0, 1, 10, 11, 30, 31, 60, 61, 500].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
