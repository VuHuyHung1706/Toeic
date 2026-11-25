import { describe, expect, it } from "vitest";
import { parseExplanation, type Block } from "./explanation";

const P7 = `**Phân tích đáp án:**

Đáp án đúng là **(C) They are more than 800 years old.** (Chúng hơn 800 tuổi).

**Dẫn chứng từ văn bản:**

**Từ Web page:**
"The findings give us a glimpse into how people went about their daily lives over 800 years ago."

**Từ Second e-mail:**
"They were especially impressed by the stone tools included among the items."

Dịch: "Các phát hiện cho chúng ta cái nhìn về cách mọi người sống hàng ngày hơn 800 năm trước."

**Phân tích:**
- Stone tools = "included among the items" from the discovery
- Discovery items = "over 800 years ago"
→ Stone tools are more than 800 years old

**Phân tích các đáp án sai:**

- **(A) They will be donated to the university** (Chúng sẽ được tặng cho đại học): SAI vì:
  - "The pieces are safe at the Orvale Natural History Museum"
  → Stay at museum (không phải donated to university)

- **(B) They were under glass in a display case** (Chúng ở dưới kính trong tủ trưng bày): SAI vì:
  - "See some of the pottery up close on the display table"
  → On display TABLE

**Từ vựng quan trọng:**
- Suggested: Được gợi ý
- Stone tools: Công cụ đá

**Dịch câu hỏi và đáp án:**`;

const P3 = `Đáp án đúng là D (A meeting with visiting colleagues) vì:
1. Trong đoạn hội thoại, người phụ nữ nói "I'd like to reserve the main conference room".
2. Điều này cho thấy cô ấy chuẩn bị cho một cuộc họp.
3. Các đáp án khác không phù hợp với thông tin trong đoạn hội thoại:
A. Không được đề cập.
C. Không được đề cập.`;

const kinds = (bs: Block[]) => bs.map((b) => (b.t === "list" ? `list:${b.kind}` : b.t));

describe("parseExplanation", () => {
  const s = parseExplanation(P7);

  it("tách theo đề mục, bỏ đề mục rỗng ở cuối", () => {
    expect(s.map((x) => x.heading)).toEqual([
      "Phân tích đáp án",
      "Dẫn chứng từ văn bản",
      "Phân tích",
      "Phân tích các đáp án sai",
      "Từ vựng quan trọng",
    ]);
  });

  it("nhận đáp án đúng, tiêu đề phụ, trích dẫn và dòng 'Dịch:'", () => {
    expect(kinds(s[0].blocks)).toEqual(["answer"]);
    expect(kinds(s[1].blocks)).toEqual(["sub", "quote", "sub", "quote", "para"]);
    expect(s[1].blocks[4]).toMatchObject({ t: "para", label: "Dịch" });
  });

  it("gạch đầu dòng + mũi tên kết luận", () => {
    expect(kinds(s[2].blocks)).toEqual(["list:bullet", "arrow"]);
  });

  it("phân tích phương án: chữ cái, nhãn Sai, ý con và mũi tên thụt vào trong", () => {
    const list = s[3].blocks[0];
    expect(list.t === "list" && list.kind).toBe("option");
    if (list.t !== "list") return;
    expect(list.items.map((i) => [i.label, i.verdict])).toEqual([
      ["A", "wrong"],
      ["B", "wrong"],
    ]);
    expect(list.items[0].text.startsWith("**They will be donated")).toBe(true);
    expect(kinds(list.items[0].children)).toEqual(["para", "arrow"]);
  });

  it("mục Từ vựng thành bảng từ – nghĩa", () => {
    expect(s[4].blocks).toEqual([
      {
        t: "vocab",
        items: [
          { term: "Suggested", meaning: "Được gợi ý" },
          { term: "Stone tools", meaning: "Công cụ đá" },
        ],
      },
    ]);
  });

  it("lời giải chữ thường (Part 3): đáp án, danh sách số, phương án A./C.", () => {
    const p = parseExplanation(P3);
    expect(p).toHaveLength(1);
    expect(kinds(p[0].blocks)).toEqual(["answer", "list:number", "list:option"]);
  });

  it("không nhận nhầm '- A meeting…' là phương án", () => {
    const p = parseExplanation("- A meeting was held.\n- Another point");
    expect(kinds(p[0].blocks)).toEqual(["list:bullet"]);
  });

  it("đoạn văn thường giữ nguyên", () => {
    const p = parseExplanation('Đáp án đúng là (D) your. "Your" là tính từ sở hữu.\nDịch: Vì chúng tôi vừa có sự thay đổi về giá.');
    expect(kinds(p[0].blocks)).toEqual(["answer", "para"]);
  });
});

describe("dòng phương án dạng 'Đáp án X (…)' và nhãn tiếng Việt", () => {
  it("Đáp án A (Kẹo): Sai - … / Đáp án B (Phô mai): Đúng - …", () => {
    const p = parseExplanation(
      'Đáp án A (Kẹo): Sai - Không được nhắc đến.\nĐáp án B (Phô mai): Đúng - Từ "cheddar cheese" được nhắc đến.',
    );
    const list = p[0].blocks[0];
    expect(list.t === "list" && list.kind).toBe("option");
    if (list.t !== "list") return;
    expect(list.items.map((i) => [i.label, i.text, i.verdict, i.note])).toEqual([
      ["A", "(Kẹo)", "wrong", "Không được nhắc đến."],
      ["B", "(Phô mai)", "right", 'Từ "cheddar cheese" được nhắc đến.'],
    ]);
  });

  it("'là đúng' ở đầu dòng; 'sai' nằm sâu trong câu sau thì không tính", () => {
    const p = parseExplanation(
      "Đáp án C (encouraged) là đúng. Đây là câu điều kiện.\n(A) relate. Đây là động từ, dùng ở đây là sai.",
    );
    const list = p[0].blocks[0];
    if (list.t !== "list") throw new Error("không phải danh sách");
    expect(list.items.map((i) => [i.label, i.verdict])).toEqual([
      ["C", "right"],
      ["A", undefined],
    ]);
    expect(list.items[0].note).toBe("Đây là câu điều kiện.");
  });

  it("'không đúng' là Sai (không nhầm thành Đúng)", () => {
    const p = parseExplanation("(D) teach: không đúng vì cần danh từ.");
    const list = p[0].blocks[0];
    if (list.t !== "list") throw new Error("không phải danh sách");
    expect(list.items[0]).toMatchObject({ label: "D", text: "teach", verdict: "wrong", note: "Không đúng vì cần danh từ." });
  });
});

describe("lời giải Part 5 dạng gạch đầu dòng", () => {
  const raw = `Giải thích:
- Đáp án đúng: (B) after
- Cấu trúc: "after which" (sau đó) được dùng để nối hai mệnh đề.
- (A) across (qua, ngang qua) - không phù hợp về nghĩa và ngữ pháp
- (D) among (giữa, trong số) - không tạo thành cấu trúc hợp lý
- Mẹo: "after which" là cụm quan hệ phổ biến.`;
  const p = parseExplanation(raw);

  it("bỏ đề mục 'Giải thích', gạch đầu dòng đáp án đúng thành khung đáp án", () => {
    expect(p[0].heading).toBeUndefined();
    expect(p[0].blocks[0]).toEqual({ t: "answer", text: "Đáp án đúng: (B) after" });
  });

  it("nhãn đầu gạch được in đậm", () => {
    const b = p[0].blocks[1];
    expect(b.t === "list" && b.items[0].text).toBe('**Cấu trúc:** "after which" (sau đó) được dùng để nối hai mệnh đề.');
  });

  it("'không phù hợp' → Sai nhưng giữ nguyên cụm trong phần giải thích", () => {
    const b = p[0].blocks[2];
    if (b.t !== "list") throw new Error("không phải danh sách");
    expect(b.items[0]).toMatchObject({ label: "A", text: "across (qua, ngang qua)", verdict: "wrong", note: "Không phù hợp về nghĩa và ngữ pháp" });
    expect(b.items[1].label).toBe("D");
    expect(b.items[1].verdict).toBeUndefined();
  });
});

it("Part 6: '- A \"…\" (…) - sai vì …' là phương án", () => {
  const p = parseExplanation('- A "Staff members have written articles" (Nhân viên đã viết bài) - sai vì không liên quan.');
  const b = p[0].blocks[0];
  if (b.t !== "list") throw new Error("không phải danh sách");
  expect(b.kind).toBe("option");
  expect(b.items[0]).toMatchObject({ label: "A", verdict: "wrong", note: "Không liên quan." });
});

it("mục Từ vựng có dòng 'A = B' (diễn đạt lại) giữ dạng gạch đầu dòng", () => {
  const p = parseExplanation('Từ vựng:\n- "vote" (bỏ phiếu) = "opinions" (ý kiến)\n- "respond" - trả lời');
  expect(p[0].blocks[0].t).toBe("list");
});
