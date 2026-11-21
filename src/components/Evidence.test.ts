import { readFileSync } from "node:fs";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { highlightPair, type EvidenceItem } from "./Evidence";
import type { TestData } from "@/lib/types";

const html = (node: ReturnType<typeof highlightPair>) => renderToStaticMarkup(createElement(Fragment, null, node));
const marks = (s: string) => [...s.matchAll(/<mark[^>]*class="[^"]*(hl-\d)"[^>]*>([^<]*)<\/mark>/g)].map((m) => [m[1], m[2]]);

describe("highlightPair (tô dẫn chứng ở bản dịch tiếng Việt)", () => {
  it("chỉ tô câu dịch tương ứng, đúng màu từng câu hỏi (đoạn thư High View, 2026 Test 1)", () => {
    const test = JSON.parse(readFileSync("content/tests/2026-test1.json", "utf8")) as TestData;
    const group = test.parts.find((p) => p.part === 7)!.groups[0];
    const para = group.passages.flatMap((p) => {
      const en = p.en.split("\n");
      const vi = p.vi.split("\n");
      const i = en.findIndex((l) => l.startsWith("Riverside Paving"));
      return i < 0 ? [] : [{ en: en[i], vi: vi[vi.findIndex((l) => l.startsWith("Công ty Riverside"))] }];
    })[0];
    expect(para).toBeTruthy();
    const items: EvidenceItem[] = group.questions.map((q, i) => ({ n: q.number, spans: q.evidence ?? [], cls: `hl-${i + 1}` }));

    const got = marks(html(highlightPair(para.vi, para.en, items)));
    expect(got).toHaveLength(3);
    // câu 1: hai câu đầu (Riverside … tái tạo bề mặt / phải được di chuyển trước 8 giờ)
    expect(got[0][0]).toBe("hl-1");
    expect(got[0][1]).toMatch(/^Công ty Riverside Paving/);
    expect(got[1][0]).toBe("hl-1");
    expect(got[1][1]).toMatch(/^Tất cả các phương tiện/);
    // câu 2: chỉ câu cuối (sẽ nhận e-mail nếu chỗ đỗ xe bị dời hơn 20 mét)
    expect(got[2][0]).toBe("hl-2");
    expect(got[2][1]).toMatch(/^Bạn sẽ nhận được e-mail/);
  });

  it("không tô gì khi số câu hai bên không khớp", () => {
    const items: EvidenceItem[] = [{ n: 1, spans: ["the office will close early"], cls: "hl-1" }];
    const out = html(highlightPair("Văn phòng sẽ đóng cửa sớm và mở lại vào thứ Hai.", "The office will close early. It reopens on Monday.", items));
    expect(out).not.toContain("<mark");
  });

  it("không tách câu sau từ viết tắt (Mr., A.M. giữa câu)", () => {
    const items: EvidenceItem[] = [{ n: 1, spans: ["will meet Mr. Park at the station"], cls: "hl-1" }];
    const en = "Ms. Lee will meet Mr. Park at the station at 9 A.M. on Friday. They will then visit the factory.";
    const vi = "Bà Lee sẽ gặp ông Park ở nhà ga lúc 9 giờ sáng thứ Sáu. Sau đó họ sẽ thăm nhà máy.";
    expect(marks(html(highlightPair(vi, en, items)))).toEqual([["hl-1", "Bà Lee sẽ gặp ông Park ở nhà ga lúc 9 giờ sáng thứ Sáu."]]);
  });
});
