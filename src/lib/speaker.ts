// Nhãn người nói ở đầu lượt lời trong script Part 3/4 — giữ nguyên chữ như trong đề ("M-Cn", "W-Am", "V-Au", "M2", "Nam"…),
// chỉ tách ra để tô màu. Kiểu ghi trong dữ liệu: có/không dấu hai chấm ("W-Am: Hi" / "W-Am Hi"), có ** ("**M-Cn: **"),
// viết thường ("w-Br"), có khoảng trắng ("M- Cn"), dấu chấm ("W.Am"), nhãn chữ ("Man:", "Nam:", "Nữ:", "W-Nữ:").

export interface Speaker {
  /** nhãn hiển thị, giữ nguyên như trong đề (đã bỏ ** và dấu hai chấm) */
  label: string;
  /** giới tính đoán theo nhãn (để chọn tông màu); null nếu không rõ ("V-Au") */
  gender: "M" | "W" | null;
  /** mã giọng: am, br, cn, au, nz */
  accent: string | null;
}

export const ACCENTS: Record<string, string> = { am: "Mỹ", br: "Anh", cn: "Canada", au: "Úc", nz: "New Zealand" };

// [nháy] [**] NHÃN [**] [:] [**]
// - nhãn chữ (Man, Woman, Nam, Nữ; "W-Nữ", "V-Nam") bắt buộc có dấu hai chấm (tránh nhầm tên riêng "Nam …");
// - W/M (+ số, + giọng): có hoặc không dấu hai chấm;
// - chữ khác + giọng đã biết ("V-Au", "N-Au", "Mi-Au"): có hoặc không dấu hai chấm.
const LINE_RE = new RegExp(
  String.raw`^\s*["“]?\s*(?:\*\*)?\s*(` +
    String.raw`(?:[A-Za-z]\s*-\s*)?(?:Man|Woman|Nam|Nữ)\s*\d?(?=\s*(?:\*\*)?\s*:)` +
    "|" +
    String.raw`[WMwm]\s*\d?(?:\s*[-.]\s*[A-Za-zữ]{1,4}|\s+(?:Am|Br|Cn|Au|Nz)(?=\s*(?:\*\*)?\s*:))?(?=\s*(?:\*\*)?\s*:|\s)` +
    "|" +
    String.raw`[A-Za-z]{1,2}\s*[-.]\s*(?:Am|Br|Cn|Au|Nz|am|br|cn|au|nz)(?=\s*(?:\*\*)?\s*:|\s)` +
    String.raw`)\s*(?:\*\*)?\s*:?\s*(?:\*\*)?\s*`,
  "u",
);

/** Tách nhãn người nói ở đầu dòng; null nếu dòng không có nhãn */
export function splitSpeaker(line: string): { speaker: Speaker; rest: string } | null {
  const m = LINE_RE.exec(line);
  if (!m) return null;
  const label = m[1].trim();
  const head = label.toLowerCase();
  const gender: "M" | "W" | null =
    /^(man|nam)\b/u.test(head) || /-\s*nam$/u.test(head)
      ? "M"
      : /^(woman|nữ)/u.test(head) || /-\s*nữ$/u.test(head)
        ? "W"
        : head[0] === "m"
          ? "M"
          : head[0] === "w"
            ? "W"
            : null;
  const code = head.match(/[-.\s]\s*([a-z]{2})$/)?.[1] ?? null;
  return {
    speaker: { label, gender, accent: code && code in ACCENTS ? code : null },
    rest: line.slice(m[0].length).replace(/\*\*/g, ""),
  };
}

/** khoá so sánh hai nhãn: bỏ khoảng trắng, dấu chấm/gạch, không phân biệt hoa thường ("M- Cn" = "M-Cn" = "m.cn") */
const keyOf = (s: Speaker) => s.label.toLowerCase().replace(/[\s.\-]/g, "");

/**
 * Tông màu cho từng người nói trong một đoạn hội thoại (theo các dòng tiếng Anh): "M1", "M2"… cho nam, "W1"… cho nữ,
 * "X1"… cho nhãn không rõ giới. Cùng nhãn → cùng màu; nhãn trơn "W"/"M" lẫn với nhãn có giọng ("W-Am") coi là một người.
 */
export function speakerTones(lines: string[]): (s: Speaker) => string {
  const order: Record<"M" | "W" | "X", string[]> = { M: [], W: [], X: [] };
  for (const l of lines) {
    const s = splitSpeaker(l)?.speaker;
    if (!s) continue;
    const g = s.gender ?? "X";
    const k = keyOf(s);
    if (!order[g].includes(k)) order[g].push(k);
  }
  const alias = new Map<string, string>();
  for (const g of ["M", "W"] as const) {
    const plain = g.toLowerCase();
    const accented = order[g].find((k) => k !== plain && !/\d/.test(k));
    if (accented && order[g].includes(plain)) {
      order[g] = order[g].filter((k) => k !== plain);
      alias.set(plain, accented);
    }
  }
  return (s) => {
    const g = s.gender ?? "X";
    const k = keyOf(s);
    const i = order[g].indexOf(alias.get(k) ?? k);
    return `${g}${i < 0 ? 1 : i + 1}`;
  };
}
