import { describe, expect, it } from "vitest";
import { parsePassage, sameShape, splitMarkers, tableCells, tableGrid } from "@/lib/passage";

const kinds = (text: string) => parsePassage(text).map((d) => [d.kind, d.blocks.map((b) => b.kind)]);

describe("parsePassage", () => {
  it("email: nhãn loại thư + khối To/From/Date/Subject + đoạn văn", () => {
    const text = [
      "E-Mail message",
      "From: Erica Pittman <contact@pittmansolutions.com>",
      "To: Jessica Chambers",
      "Subject: Your Web site",
      "Date: April 19",
      "Dear Ms. Chambers,",
      "I am contacting you to offer my services in improving your Web site and its product descriptions.",
      "Sincerely,",
      "Erica Pittman",
    ].join("\n");
    expect(kinds(text)).toEqual([["email", ["label", "headers", "para", "para", "para", "para"]]]);
    const [doc] = parsePassage(text);
    expect(doc.blocks[1]).toEqual({ kind: "headers", rows: [1, 2, 3, 4] });
  });

  it("tin nhắn: tên + giờ ([…] hoặc (…)), nội dung tới tên kế tiếp", () => {
    const text = "Reggie Norris [11:06 A.M.]\nHi, Sarah.\nCould you come in?\nSarah Klein [11:07 A.M.]\nSure.\nReggie Norris (11:10 A.M.) Thanks!";
    const [doc] = parsePassage(text);
    expect(doc.kind).toBe("chat");
    expect(doc.blocks).toEqual([
      { kind: "chat", head: 0, body: [1, 2] },
      { kind: "chat", head: 3, body: [4] },
      { kind: "chat", head: 5, body: [] },
    ]);
  });

  it("trang web: URL + thanh menu + tiêu đề; nhiều văn bản ngăn bởi ==========", () => {
    const text = "http://www.antizio.com\nHome | About Us | Our Products | Contact Us\nANTIZIO International\nWe sell tile.\n==========\nMEMO\nTo: Staff\nFrom: Kiriko\nDate: May 2\nHello team.";
    expect(kinds(text)).toEqual([
      ["web", ["url", "nav", "heading", "para"]],
      ["email", ["label", "headers", "para"]],
    ]);
  });

  it("biểu mẫu: Nhãn: giá trị (kèm dòng nối thụt lề), ô chọn, danh sách", () => {
    const text = [
      "SERVICE REQUEST FORM",
      "Requester Name: Elenora Deckow",
      "Ship to: Kenneth Wells",
      "        280 Switzer Drive",
      "Service Type (choose one):",
      "_Cleaning",
      "X Repair",
      "_Other",
      "On our shelves you will find:",
      "* Paper in a rich variety of sizes",
      "* High-quality pens",
    ].join("\n");
    expect(kinds(text)).toEqual([["doc", ["heading", "fields", "para", "checklist", "para", "list"]]]);
    expect(parsePassage(text)[0].blocks[1]).toEqual({ kind: "fields", rows: [1, 2, 3] });
  });

  it("bảng căn cột bằng dấu cách, dòng nối thụt lề ghép vào đúng ô", () => {
    const rows = [
      "Item Code            Item Name          Quantity    Total",
      "5033R                Lund Square        2           $54.80",
      "                     Dinner Plates",
    ];
    const [doc] = parsePassage(rows.join("\n"));
    expect(doc.blocks).toEqual([{ kind: "table", rows: [0, 1, 2] }]);
    expect(tableGrid(rows)).toEqual([
      ["Item Code", "Item Name", "Quantity", "Total"],
      ["5033R", "Lund Square Dinner Plates", "2", "$54.80"],
    ]);
  });

  it("bảng dùng | giữ ô trống ở đầu dòng thụt lề", () => {
    expect(tableCells("Manufacturer | Product line")).toEqual(["Manufacturer", "Product line"]);
    expect(tableCells('         | "Brittany"–red')).toEqual(["", '"Brittany"–red']);
    expect(tableCells("| a | b |")).toEqual(["a", "b"]);
  });

  it("tin nhắn không có ngoặc quanh giờ, tiêu đề phụ, dòng liên hệ có dấu •", () => {
    const chat = parsePassage("Susan Gowan 9:23 A.M\nAre you free?\nMaggie Lorenz 9:24 A.M\nYes.")[0];
    expect(chat.kind).toBe("chat");
    const long = "Whether you're writing a poem, a birthday greeting, or a grocery list, do it in style with our products.";
    expect(kinds(`Paper Arts\n• 285 Keener Street • 555-0193\nExpress Yourself Beautifully\n${long}\nDear Mr. Peng:\n${long}`)).toEqual([
      ["doc", ["heading", "para", "heading", "para", "para", "para"]],
    ]);
  });

  it("câu thường có dấu hai chấm / ngoặc giờ không bị nhận nhầm", () => {
    const text = "The meeting begins at noon (12:00 P.M.) in Room 4, as planned by the committee last week.\nPlease note: the cafeteria will be closed on Friday because of the annual inspection and cleaning.";
    expect(kinds(text)).toEqual([["doc", ["para", "para"]]]);
  });
});

describe("menu trang web nhiều dòng", () => {
  it("≥ 3 dòng ngắn liền nhau sau URL/tiêu đề là thanh menu", () => {
    const text = "http://www.emery.com/dishware\nEMERY RESTAURANT WAREHOUSE\nHome\nProduct Categories\nAbout\nHelp Center\nLund Square Dinner Plates\nLund is known for high-quality porcelain dishware that lasts for many years of daily use.";
    expect(kinds(text)).toEqual([["web", ["url", "heading", "nav", "heading", "para"]]]);
  });
});

describe("splitMarkers / sameShape", () => {
  it("tách ký hiệu vị trí chèn câu", () => {
    expect(splitMarkers("Delays are common. [1] More text [2]")).toEqual([
      "Delays are common. ",
      { marker: 1 },
      " More text ",
      { marker: 2 },
    ]);
    expect(splitMarkers("Form: [X] Refund")).toEqual(["Form: [X] Refund"]);
  });

  it("so khớp số văn bản và số dòng giữa bản gốc và bản dịch", () => {
    expect(sameShape("a\nb\n==========\nc", "x\n\ny\n=====\nz")).toBe(true);
    expect(sameShape("a\nb", "x")).toBe(false);
  });
});

describe("tableGrid song ngữ", () => {
  it("bản dịch dùng cách chia cột của bản gốc cho dòng nối", () => {
    const en = [
      "Item Code            Item Name          Quantity             Unit Price",
      "5033R                   Lund Square          2                            $27.40",
      "                                 Dinner Plates",
    ];
    const vi = [
      "Mã SP            Tên SP          Số lượng             Đơn giá",
      "5033R                   Đĩa Vuông          2                            $27.40",
      "                                 Lund",
    ];
    expect(tableGrid(en)).toEqual([
      ["Item Code", "Item Name", "Quantity", "Unit Price"],
      ["5033R", "Lund Square Dinner Plates", "2", "$27.40"],
    ]);
    expect(tableGrid(vi, en)).toEqual([
      ["Mã SP", "Tên SP", "Số lượng", "Đơn giá"],
      ["5033R", "Đĩa Vuông Lund", "2", "$27.40"],
    ]);
  });
});
