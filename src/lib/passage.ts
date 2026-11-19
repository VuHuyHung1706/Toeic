// Phân tích văn bản bài đọc Part 7 (dạng chữ thuần, mỗi ý một dòng) thành các khối để dựng HTML:
// email/memo (dòng To/From/Date/Subject), tin nhắn (Tên [giờ]), trang web (URL, thanh menu),
// bảng (cột căn bằng ≥ 3 dấu cách hoặc "|"), biểu mẫu (Nhãn: giá trị), danh sách, tiêu đề, đoạn văn.
// Khối chỉ lưu chỉ số dòng → dùng chung cấu trúc của bản tiếng Anh cho bản dịch khi số dòng khớp.
// Quy ước dữ liệu (scripts/passage.py): văn bản kép/ba ngăn bởi "==========", ký hiệu chèn câu là "[1]".

export type Block =
  | { kind: "url"; i: number }
  /** "E-Mail message", "MEMO"… — nhãn loại văn bản */
  | { kind: "label"; i: number }
  | { kind: "nav"; rows: number[] }
  | { kind: "heading"; i: number; level: 1 | 2 }
  | { kind: "headers"; rows: number[] }
  | { kind: "chat"; head: number; body: number[] }
  | { kind: "list"; items: number[] }
  | { kind: "checklist"; items: number[] }
  | { kind: "table"; rows: number[] }
  | { kind: "fields"; rows: number[] }
  | { kind: "para"; i: number; compact: boolean };

export type DocKind = "email" | "chat" | "web" | "doc";

export interface PassageDoc {
  kind: DocKind;
  lines: string[];
  blocks: Block[];
}

export const SEPARATOR_RE = /^\s*={3,}\s*$/;
const HEADER_RE =
  /^(To|From|Date|Subject|Sent|Cc|Bcc|Re|Attachments?|Reply-To|Từ|Đến|Gửi|Gửi đến|Gửi tới|Người gửi|Người nhận|Ngày|Ngày gửi|Chủ đề|Tiêu đề|Về|Tệp đính kèm|Đính kèm|Tài liệu đính kèm)\s*:\s*(.*)$/i;
const EMAIL_TITLE_RE = /^(e-?mail(\s+message)?|memo(randum)?|thư điện tử|thư|bản ghi nhớ|thông báo nội bộ)\s*$/i;
const URL_RE = /^(https?:\/\/|www\.)\S+$/i;
const CHAT_RE = /^([\p{Lu}][\p{L}.'’-]*(?:\s+[\p{L}.'’-]+){0,3})\s*[[(]\s*(\d{1,2}[:.]\d{2}[^\])]{0,14})[\])]\s*:?\s*(.*)$/u;
const BULLET_RE = /^\s*(?:[•●▪◦·‣*✓✔➢►]|[-–—](?=\s))\s*(\S.*)$/;
const CHECK_RE = /^\s*(?:(_+|☐|□|\[\s?\])\s*|([xX☑■✗✘]|\[[xX]\])\s+)(\S.*)$/;
const FIELD_RE = /^([\p{Lu}\d][^:]{0,38}?)\s*:\s+(\S.*)$/u;

/** Chia ô của một dòng bảng: ≥ 3 dấu cách, tab, hoặc " | " */
export function tableCells(line: string): string[] {
  if (line.includes("|")) {
    // giữ ô trống ở giữa (cột để trống), bỏ ô rỗng do "|" ở đầu/cuối dòng
    const cells = line.split("|").map((c) => c.trim());
    // "|" ở ngay đầu/cuối dòng là viền bảng; thụt lề rồi mới tới "|" nghĩa là ô đầu để trống
    if (line.startsWith("|")) cells.shift();
    if (line.trimEnd().endsWith("|")) cells.pop();
    return cells;
  }
  return line
    .trim()
    .split(/\s{3,}|\t+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

export function parseHeader(line: string): { label: string; value: string } | null {
  const m = line.match(HEADER_RE);
  return m ? { label: m[1], value: m[2] } : null;
}

// không có ngoặc: "Susan Gowan 9:23 A.M" — bắt buộc có A.M./P.M. để khỏi nhầm câu thường
const CHAT_BARE_RE = /^([\p{Lu}][\p{L}.'’-]*(?:\s+[\p{L}.'’-]+){0,3})\s+(\d{1,2}:\d{2}\s*[AaPp]\.?\s?[Mm]\.?)\s*:?\s*(.*)$/u;

export function parseChatHead(line: string): { name: string; time: string; rest: string } | null {
  const m = line.match(CHAT_RE) ?? line.match(CHAT_BARE_RE);
  return m ? { name: m[1], time: m[2].trim(), rest: m[3] } : null;
}

export function parseField(line: string): { label: string; value: string } | null {
  const m = line.match(FIELD_RE);
  if (!m) return null;
  const label = m[1].trim();
  // nhãn ngắn (≤ 5 từ), không phải một câu
  if (label.split(/\s+/).length > 5 || /[.!?]$/.test(label) || /^https?$/i.test(label)) return null;
  return { label, value: m[2] };
}

export function parseCheck(line: string): { checked: boolean; text: string } | null {
  const m = line.match(CHECK_RE);
  return m ? { checked: !!m[2], text: m[3] } : null;
}

export function bulletText(line: string): string {
  return line.match(BULLET_RE)?.[1] ?? line;
}

const isNav = (line: string) => {
  const cells = tableCells(line);
  return cells.length >= 3 && cells.every((c) => c.length <= 24 && !/\d{2,}/.test(c));
};
/** Dòng thụt lề sâu (≥ 4 dấu cách đầu dòng) — phần nối của dòng bảng / biểu mẫu phía trên */
const isIndented = (raw: string) => /^\s{4,}\S/.test(raw);
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
/** "January 17", "17 January 2024", "Tháng 1 …" — dòng ngày ở đầu thư, không phải tiêu đề */
const isDateLine = (s: string) =>
  new RegExp(`^(?:(?:${MONTHS})\\s+\\d{1,2}(?:,\\s*\\d{4})?|\\d{1,2}\\s+(?:${MONTHS})(?:\\s+\\d{4})?)\\.?$`).test(s.trim());
const isMenuItem = (s: string) => s.length <= 24 && s.split(/\s+/).length <= 3 && !/[\d.,:;!?]/.test(s.replace(/\.$/, ""));
const isShort = (s: string) => s.length <= 60 && !/[.!?;,]["”’)]?$/.test(s.trim());
/** Dòng ngắn viết hoa đầu mỗi từ, ngay trước một đoạn dài → tiêu đề phụ ("Express Yourself Beautifully") */
const isSubheading = (s: string, next: string | undefined) => {
  const words = s.trim().split(/\s+/);
  if (!isShort(s) || s.length > 50 || words.length < 2 || !next || next.trim().length < 80) return false;
  // lời chào, dòng tiêu đề thư, địa chỉ / ngày tháng / giờ không phải tiêu đề
  if (/^(by|dear|to|from|subject|date|re)\b/i.test(s) || /[,]/.test(s) || /\d{1,2}:\d{2}/.test(s)) return false;
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(s)) return false;
  if (/\(/.test(s) && /\d/.test(s)) return false; // "WILLETTVILLE (March 8)-…" (dòng ngày của bản tin)
  const minor = /^(a|an|the|and|or|of|for|to|in|on|at|with|your|our)$/;
  return words.every((w) => /^[\p{Lu}\d"“'‘(&]/u.test(w) || minor.test(w));
};
const isAllCaps = (s: string) => /\p{Lu}/u.test(s) && !/\p{Ll}/u.test(s) && s.length <= 60;

/** Các văn bản trong đoạn (ngăn bởi "=========="), mỗi văn bản là danh sách dòng khác rỗng */
export function splitDocs(text: string): string[][] {
  const docs: string[][] = [[]];
  for (const raw of text.split("\n")) {
    if (SEPARATOR_RE.test(raw)) {
      docs.push([]);
      continue;
    }
    if (raw.trim()) docs[docs.length - 1].push(raw.replace(/\s+$/, ""));
  }
  return docs.filter((d) => d.length);
}

export function parseDoc(lines: string[]): PassageDoc {
  const blocks: Block[] = [];
  const n = lines.length;
  let i = 0;
  let sawUrl = false;
  let headerDone = false;
  const chatHeads = lines.filter((l) => parseChatHead(l)).length;
  const isChat = chatHeads >= 2;

  while (i < n) {
    const line = lines[i].trim();

    // URL trình duyệt ở đầu văn bản + thanh menu ngay sau đó
    if (i <= 1 && URL_RE.test(line)) {
      blocks.push({ kind: "url", i });
      sawUrl = true;
      i++;
      continue;
    }
    if (sawUrl && i <= 3 && isNav(line)) {
      blocks.push({ kind: "nav", rows: [i] });
      i++;
      continue;
    }
    // menu trang web mỗi mục một dòng ("Home" / "Product Categories" / "About"…), ≥ 3 dòng liền nhau ở đầu trang
    if (sawUrl && i <= 6 && isMenuItem(line)) {
      let j = i;
      while (j < n && isMenuItem(lines[j].trim())) j++;
      if (j - i >= 3) {
        blocks.push({ kind: "nav", rows: Array.from({ length: j - i }, (_, k) => i + k) });
        i = j;
        continue;
      }
    }

    // phần đầu email/memo: các dòng To/From/Date/Subject liên tiếp trong 8 dòng đầu
    if (!headerDone && i < 8 && parseHeader(line)) {
      const rows: number[] = [];
      while (i < n && parseHeader(lines[i].trim())) rows.push(i++);
      if (rows.length >= 2) {
        blocks.push({ kind: "headers", rows });
        headerDone = true;
        continue;
      }
      i = rows[0];
    }

    // tin nhắn: "Tên [11:06 A.M.]" rồi nội dung tới tên kế tiếp
    if (isChat && parseChatHead(line)) {
      const head = i++;
      const body: number[] = [];
      while (i < n && !parseChatHead(lines[i].trim())) body.push(i++);
      blocks.push({ kind: "chat", head, body });
      continue;
    }

    // biểu mẫu chọn ô: "_Cleaning" / "X Repair" (≥ 2 dòng liên tiếp, có ít nhất một ô trống)
    if (parseCheck(line)) {
      let j = i;
      while (j < n && parseCheck(lines[j].trim())) j++;
      const items = Array.from({ length: j - i }, (_, k) => i + k);
      if (items.length >= 2 && items.some((k) => !parseCheck(lines[k].trim())!.checked)) {
        blocks.push({ kind: "checklist", items });
        i = j;
        continue;
      }
    }

    // danh sách gạch đầu dòng (một dòng kiểu "• 285 Keener Street • 555-0193" là dòng liên hệ, không phải danh sách)
    if (BULLET_RE.test(line)) {
      const items: number[] = [];
      while (i < n && BULLET_RE.test(lines[i].trim())) items.push(i++);
      if (items.length > 1 || !/\s[•●▪·]\s/.test(line)) {
        blocks.push({ kind: "list", items });
        continue;
      }
      i = items[0];
      blocks.push({ kind: "para", i, compact: true });
      i++;
      continue;
    }

    // bảng: ≥ 2 dòng liên tiếp có ≥ 2 ô (hoặc 1 dòng dùng "|")
    if (tableCells(lines[i]).length >= 2) {
      const rows: number[] = [];
      while (
        i < n &&
        ((tableCells(lines[i]).length >= 2 && !parseChatHead(lines[i].trim())) || (rows.length > 0 && isIndented(lines[i])))
      )
        rows.push(i++);
      if (rows.length >= 2 || (rows.length === 1 && lines[rows[0]].includes("|"))) {
        blocks.push({ kind: "table", rows });
        continue;
      }
      if (rows.length) i = rows[0];
    }

    // biểu mẫu "Nhãn: giá trị" (≥ 2 dòng liên tiếp)
    if (parseField(line)) {
      let j = i;
      let fieldCount = 0;
      while (j < n && ((parseField(lines[j].trim()) && tableCells(lines[j]).length < 2) || (j > i && isIndented(lines[j])))) {
        if (parseField(lines[j].trim())) fieldCount++;
        j++;
      }
      if (fieldCount >= 2) {
        blocks.push({ kind: "fields", rows: Array.from({ length: j - i }, (_, k) => i + k) });
        i = j;
        continue;
      }
    }

    if (EMAIL_TITLE_RE.test(line)) {
      blocks.push({ kind: "label", i });
      i++;
      continue;
    }

    // tiêu đề: dòng đầu ngắn (sau URL/tên loại thư) hoặc dòng VIẾT HOA ngắn
    const firstContent = blocks.every((b) => b.kind === "url" || b.kind === "nav" || b.kind === "label");
    const firstTitle = firstContent && !isDateLine(line) && (isShort(line) || (/[!?]$/.test(line) && line.length <= 70));
    if (firstTitle || isAllCaps(line) || isSubheading(line, lines[i + 1])) {
      blocks.push({ kind: "heading", i, level: firstContent ? 1 : 2 });
      i++;
      continue;
    }

    blocks.push({ kind: "para", i, compact: isShort(line) });
    i++;
  }

  const hasHeaders = blocks.some((b) => b.kind === "headers");
  const kind: DocKind = isChat ? "chat" : hasHeaders ? "email" : sawUrl ? "web" : "doc";
  return { kind, lines, blocks };
}

export function parsePassage(text: string): PassageDoc[] {
  return splitDocs(text).map(parseDoc);
}

/** Bản dịch có cùng cấu trúc dòng với bản gốc không (để ghép song ngữ theo từng dòng) */
export function sameShape(en: string, vi: string): boolean {
  const a = splitDocs(en);
  const b = splitDocs(vi);
  return a.length === b.length && a.every((d, k) => d.length === b[k].length);
}

/** Tách ký hiệu vị trí chèn câu "[1]"…"[4]" khỏi chữ */
export function splitMarkers(text: string): (string | { marker: number })[] {
  const out: (string | { marker: number })[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[([1-4])\]/g)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ marker: Number(m[1]) });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Ô của một dòng kèm vị trí bắt đầu (cột căn bằng dấu cách) */
function cellsWithPos(line: string): { text: string; start: number }[] {
  if (line.includes("|")) {
    let pos = 0;
    return tableCells(line).map((text) => ({ text, start: pos++ * 1000 })); // "|": giữ nguyên thứ tự ô
  }
  // ô = các từ cách nhau tối đa 2 dấu cách
  return [...line.matchAll(/\S+(?: {1,2}\S+)*/g)].map((m) => ({ text: m[0], start: m.index! }));
}

/** Gán cột cho từng ô của các dòng bảng */
function layout(rows: string[]): { texts: string[][]; cols: number[][]; width: number } {
  const cells = rows.map(cellsWithPos);
  const texts = cells.map((c) => c.map((x) => x.text));
  if (rows.some((r) => r.includes("|"))) {
    return { texts, cols: cells.map((c) => c.map((_, k) => k)), width: Math.max(...cells.map((c) => c.length)) };
  }
  // mốc cột = vị trí các ô của dòng nhiều ô nhất (thường là dòng tiêu đề); ô khác rơi vào cột chứa nó
  const widest = cells.reduce((best, c) => (c.length > best.length ? c : best), cells[0]);
  const anchors = widest.map((c) => c.start);
  const colOf = (start: number) => {
    let k = 0;
    anchors.forEach((a, idx) => {
      if (a <= start + 3) k = idx;
    });
    return k;
  };
  const cols = cells.map((c) =>
    c.length === anchors.length ? c.map((_, k) => k) : c.map((x) => colOf(x.start)), // đủ ô → theo thứ tự (OCR căn lề không đều)
  );
  return { texts, cols, width: anchors.length };
}

/**
 * Dựng lưới ô cho bảng căn cột bằng dấu cách: ô trống / dòng nối (thụt lề, 1 ô) rơi đúng cột,
 * dòng nối được ghép vào ô cùng cột của dòng trên. Bảng dùng "|" giữ nguyên thứ tự ô.
 * like: các dòng bản gốc tương ứng — bản dịch dùng cách chia cột của bản gốc (chữ Việt dài/ngắn khác nên vị trí lệch).
 */
export function tableGrid(rows: string[], like?: string[]): string[][] {
  const base = layout(like ?? rows);
  const own = like ? layout(rows) : base;
  const cols = rows.map((_, r) => (own.texts[r].length === base.texts[r]?.length ? base.cols[r] : own.cols[r]));
  const ref = like ?? rows;
  const out: string[][] = [];
  const outBase: string[][] = [];
  rows.forEach((_, r) => {
    const row = new Array<string>(base.width).fill("");
    own.texts[r].forEach((t, k) => {
      const c = Math.min(cols[r][k], base.width - 1);
      row[c] = row[c] ? `${row[c]} ${t}` : t;
    });
    const baseRow = new Array<string>(base.width).fill("");
    base.texts[r]?.forEach((t, k) => (baseRow[Math.min(base.cols[r][k], base.width - 1)] = t));
    const isCont = r > 0 && base.texts[r]?.length === 1 && isIndented(ref[r]) && out.length > 0;
    if (isCont) {
      const k = baseRow.findIndex(Boolean);
      const text = row.filter(Boolean).join(" ");
      const prev = out[out.length - 1];
      prev[k] = prev[k] ? `${prev[k]} ${text}` : text;
      outBase[outBase.length - 1][k] ||= baseRow[k];
    } else {
      out.push(row);
      outBase.push(baseRow);
    }
  });
  // bỏ cột trống hoàn toàn (theo bản gốc để hai bản cùng số cột)
  const keep = Array.from({ length: base.width }, (_, k) => outBase.some((row) => row[k]));
  return out.map((row) => row.filter((_, k) => keep[k]));
}
