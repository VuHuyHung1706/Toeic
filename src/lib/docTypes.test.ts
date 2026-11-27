import { describe, expect, it } from "vitest";
import { assignDocTypes, docTitle, docTypes, passageDocTypes } from "./docTypes";

describe("docTypes", () => {
  it("một văn bản", () => {
    expect(docTypes("text-message chain", 1)).toEqual(["text-message chain"]);
    expect(docTypes("Web page", 1)).toEqual(["web page"]);
  });
  it("hai, ba văn bản", () => {
    expect(docTypes("article and letter", 2)).toEqual(["article", "letter"]);
    expect(docTypes("article, e-mail, and plan", 3)).toEqual(["article", "e-mail", "plan"]);
    expect(docTypes("Web page, contact form, and e-mail", 3)).toEqual(["web page", "contact form", "e-mail"]);
  });
  it("số nhiều chiếm phần văn bản còn lại", () => {
    expect(docTypes("e-mails and notice", 3)).toEqual(["e-mail", "e-mail", "notice"]);
    expect(docTypes("e-mails", 2)).toEqual(["e-mail", "e-mail"]);
    expect(docTypes("instructions", 1)).toEqual(["instructions"]);
  });
  it("lệch số văn bản thì không gắn nhãn", () => {
    expect(docTypes("article and letter", 3)).toEqual([]);
  });
  it("chia theo đoạn", () => {
    expect(passageDocTypes("article and e-mail", ["A\n==========\nB"])).toEqual([["article", "e-mail"]]);
    expect(passageDocTypes("article and e-mail", ["A", "B"])).toEqual([["article"], ["e-mail"]]);
    expect(passageDocTypes(undefined, ["A"])).toEqual([undefined]);
  });
  it("tên hiển thị", () => {
    expect(docTitle("web page")).toEqual({ en: "Web page", vi: "Trang web" });
    expect(docTitle("notice")).toEqual({ en: "Notice", vi: "Thông báo" });
  });
});

describe("assignDocTypes", () => {
  it("văn bản dạng email nhận loại e-mail dù đứng sau", () => {
    expect(assignDocTypes("e-mails and notice", ["email", "doc", "email"])).toEqual(["e-mail", "notice", "e-mail"]);
  });
  it("không gộp số nhiều thì giữ thứ tự của đề", () => {
    expect(assignDocTypes("article and e-mail", ["email", "doc"])).toEqual(["article", "e-mail"]);
  });
});
