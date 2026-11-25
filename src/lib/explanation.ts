// Đọc lời giải (chữ thô từ CSV: "**đậm**", đề mục "Phân tích:", gạch đầu dòng, "1.", "A.", "→"…) thành các khối có cấu trúc
// để giao diện hiển thị gọn (components/Explanation.tsx). Lời giải viết nhiều kiểu khác nhau → chỉ nhận dạng những mẫu
// chắc chắn, còn lại giữ nguyên thành đoạn văn.

export type ListItem = {
  /** "1", "A"… (danh sách đánh số / phương án) */
  label?: string;
  text: string;
  /** "Sai" / "Đúng" khi dòng phương án ghi rõ (SAI vì…, ĐÚNG…) */
  verdict?: "wrong" | "right";
  children: Block[];
};

export type Block =
  | { t: "answer"; text: string }
  | { t: "para"; text: string; label?: string }
  | { t: "quote"; text: string }
  | { t: "arrow"; text: string }
  | { t: "sub"; text: string }
  | { t: "list"; kind: "bullet" | "number" | "option"; items: ListItem[] }
  | { t: "vocab"; items: { term: string; meaning: string }[] };

export type Section = { heading?: string; blocks: Block[] };

const BULLET = /^[-•*]\s+(.*)$/;
const NUMBER = /^(\d{1,2})[.)]\s+(.*)$/;
// "A. …", "(A) …", "**(A) …**", "Đáp án A: …" — chữ cái phải có ngoặc hoặc dấu chấm/hai chấm (tránh "- A meeting…")
const OPTION = /^(\*\*)?(?:Đáp án\s+)?(?:\(([A-D])\)|([A-D])[.:)])\s*(?=\S)(.*)$/;
const ARROW = /^(?:→|=>|->|⇒)\s*(.*)$/;
const ANSWER = /^(?:\*\*)?Đáp án (?:đúng )?(?:là|:)/i;
const LABEL =
  /^((?:Dịch(?: nghĩa| câu)?|Nghĩa|Lưu ý|Chú ý|Mẹo(?: làm bài)?|Paraphrase|Cấu trúc|Ngữ pháp|Kết luận|Ví dụ|Dẫn chứng|Bằng chứng|Giải thích|Lý do))\s*:\s+(\S.*)$/i;
const WRONG = /\b(SAI|không đúng|không chính xác)\b/;
const RIGHT = /\b(ĐÚNG)\b/;

/** Dòng là đề mục: "**Phân tích:**", "Các đáp án khác không chính xác:" (ngắn, kết thúc bằng dấu hai chấm) */
function headingOf(line: string): string | null {
  const bold = line.match(/^\*\*([^*]{2,80}?):?\*\*:?$/);
  if (bold) return bold[1].replace(/:$/, "").trim();
  if (line.length <= 70 && /:$/.test(line) && !/["“”]/.test(line) && !ANSWER.test(line) && !/^[-•*→\d(]/.test(line)) {
    return line.slice(0, -1).trim();
  }
  return null;
}

function stripBold(s: string) {
  return s.replace(/^\*\*(.*)\*\*$/, "$1");
}

function verdictOf(text: string): ListItem["verdict"] {
  if (RIGHT.test(text)) return "right";
  if (WRONG.test(text)) return "wrong";
  return undefined;
}

export function parseExplanation(raw: string): Section[] {
  const blocks: (Block | { t: "heading"; text: string })[] = [];
  // danh sách đang mở (giữ trong object để TypeScript không thu hẹp kiểu qua các closure)
  const st: { list: Extract<Block, { t: "list" }> | null } = { list: null };

  const closeList = () => {
    st.list = null;
  };
  const pushItem = (kind: "bullet" | "number" | "option", item: ListItem) => {
    if (!st.list || st.list.kind !== kind) {
      st.list = { t: "list", kind, items: [] };
      blocks.push(st.list);
    }
    st.list.items.push(item);
  };

  for (const rawLine of raw.replace(/\r/g, "").split("\n")) {
    if (!rawLine.trim()) continue; // dòng trống không cắt danh sách (lời giải hay để trống giữa các phương án)
    const indent = rawLine.match(/^\s*/)![0].replace(/\t/g, "  ").length;
    const line = rawLine.trim();
    const last = st.list?.items.at(-1);

    // dòng thụt vào ngay dưới một mục → thuộc mục đó (ý con, mũi tên kết luận)
    if (indent >= 2 && last) {
      const a = line.match(ARROW);
      const b = line.match(BULLET);
      if (a) last.children.push({ t: "arrow", text: a[1] });
      else if (b) last.children.push({ t: "para", text: b[1] });
      else last.children.push({ t: "para", text: line });
      continue;
    }

    const heading = headingOf(line);
    if (heading) {
      closeList();
      blocks.push({ t: "heading", text: heading });
      continue;
    }
    if (ANSWER.test(line)) {
      closeList();
      blocks.push({ t: "answer", text: line.replace(/\s*Giải thích:?\s*$/i, "") });
      continue;
    }
    const arrow = line.match(ARROW);
    if (arrow) {
      // mũi tên ngay sau một phương án / ý → kết luận của ý đó
      if (last && st.list?.kind === "option") last.children.push({ t: "arrow", text: arrow[1] });
      else {
        closeList();
        blocks.push({ t: "arrow", text: arrow[1] });
      }
      continue;
    }
    const bullet = line.match(BULLET);
    const opt = (bullet ? bullet[1] : line).match(OPTION);
    if (opt) {
      // "**(A) They will…** (nghĩa): SAI vì:" → giữ cặp ** cho phần chữ của phương án
      const text = (opt[1] ?? "") + opt[4];
      pushItem("option", { label: opt[2] ?? opt[3], text, verdict: verdictOf(text), children: [] });
      continue;
    }
    if (bullet) {
      pushItem("bullet", { text: bullet[1], children: [] });
      continue;
    }
    const num = line.match(NUMBER);
    if (num) {
      pushItem("number", { label: num[1], text: num[2], children: [] });
      continue;
    }
    closeList();
    if (/^["“].+["”][.!?]?$/.test(line)) blocks.push({ t: "quote", text: line });
    else {
      const lab = line.match(LABEL);
      blocks.push(lab ? { t: "para", label: lab[1], text: lab[2] } : { t: "para", text: line });
    }
  }

  // gom thành mục theo đề mục; đề mục ngay sau một đề mục rỗng → tiêu đề phụ trong mục đó; bỏ mục rỗng
  const sections: Section[] = [];
  let cur: Section = { blocks: [] };
  for (const b of blocks) {
    if (b.t === "heading") {
      // nhãn nguồn trích dẫn ("Từ Web page", "Theo e-mail thứ hai", "Trong bài báo") là tiêu đề phụ của mục đang mở
      const sourceLabel = cur.heading !== undefined && /^(Từ|Theo|Trong)\s(?!vựng)/i.test(b.text) && b.text.length <= 40;
      if (sourceLabel || (cur.heading !== undefined && cur.blocks.length === 0)) {
        cur.blocks.push({ t: "sub", text: b.text });
        continue;
      }
      if (cur.heading !== undefined || cur.blocks.length) sections.push(cur);
      cur = { heading: b.text, blocks: [] };
      continue;
    }
    cur.blocks.push(b);
  }
  if (cur.heading !== undefined || cur.blocks.length) sections.push(cur);

  return sections
    .map((s) => ({ ...s, blocks: s.heading && /từ vựng/i.test(s.heading) ? toVocab(s.blocks) : s.blocks }))
    .filter((s) => s.blocks.length > 0);
}

/** Mục "Từ vựng": danh sách "từ: nghĩa" → bảng hai cột */
function toVocab(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.t !== "list" || b.kind !== "bullet") return b;
    const items = b.items.map((it) => {
      const m = stripBold(it.text).match(/^\**(.+?)\**\s*(?::|–|-|=)\s+(.+)$/);
      return m ? { term: m[1].replace(/\*\*/g, "").trim(), meaning: m[2].trim() } : null;
    });
    return items.every(Boolean) ? { t: "vocab", items: items as { term: string; meaning: string }[] } : b;
  });
}
