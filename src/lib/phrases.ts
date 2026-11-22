// Cụm từ đi với giới từ: khoá thẻ ghi nhớ và tìm cụm trong câu ví dụ để tô sáng.

/** Khoá lưu tiến độ thẻ (chung kho thẻ với từ vựng, có tiền tố để không trùng; kèm nhóm vì vài cụm có ở 2 nhóm) */
export const phraseCardKey = (group: string, phrase: string) => `cgt:${group}:${phrase}`;

// chữ thay thế trong cụm: "add A to B", "provide sb with sth"
const PLACEHOLDER = /^(a|b|sb|sth|someone|something|n|v|v-ing|ving|doing|do|o)$/i;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// động từ bất quy tắc hay gặp trong cụm
const IRREGULAR: Record<string, string[]> = {
  lead: ["led"], pay: ["paid"], run: ["ran"], take: ["took", "taken"], make: ["made"], give: ["gave", "given"],
  find: ["found"], bring: ["brought"], buy: ["bought"], keep: ["kept"], meet: ["met"], send: ["sent"], spend: ["spent"],
  hold: ["held"], come: ["came"], go: ["went", "gone"], get: ["got", "gotten"], think: ["thought"], write: ["wrote", "written"],
  speak: ["spoke", "spoken"], leave: ["left"], fall: ["fell", "fallen"], set: ["set"], put: ["put"], deal: ["dealt"],
};
// giới từ / từ ngắn không cho thêm đuôi (in ≠ into)
const FIXED = new Set(["to", "in", "on", "at", "of", "by", "for", "off", "out", "up", "a", "an", "the", "as", "per", "via", "into", "onto", "with", "from"]);

/** mẫu cho một từ: cho phép đuôi biến đổi (apply → applied; tip → tips; log → logging) và dạng bất quy tắc */
function wordPattern(w: string) {
  const lw = w.toLowerCase();
  if (FIXED.has(lw)) return esc(w);
  const forms = [w.length >= 4 ? `${esc(w.replace(/(e|y)$/i, ""))}[\\w'’]*` : `${esc(w)}[\\w'’]*`, ...(IRREGULAR[lw] ?? []).map(esc)];
  return forms.length > 1 ? `(?:${forms.join("|")})` : forms[0];
}

/**
 * Biểu thức tìm cụm trong câu: các từ của cụm theo thứ tự, giữa hai từ có thể chen tối đa 4 từ khác
 * (chỗ của A/B, tính từ…). "x / y" là một trong hai; "(…)" là không bắt buộc.
 */
export function phraseRegex(phrase: string): RegExp | null {
  // "at a discount / at a discounted rate": hai cách nói trọn vẹn → thử từng cách
  const whole = phrase.split(/\s+\/\s+/);
  if (whole.length > 1 && whole.every((p) => p.trim().split(/\s+/).length > 1)) {
    const parts = whole.map((p) => phraseRegex(p)?.source.replace(/^\\b|\\b$/g, "")).filter(Boolean);
    return parts.length ? new RegExp(`\\b(?:${parts.join("|")})\\b`, "i") : null;
  }
  const slots: { alts: string[]; optional: boolean }[] = [];
  const tokens = phrase.replace(/\.\.\.|…/g, " ").match(/\([^)]*\)|\/|[^\s/()]+/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "/") {
      const next = tokens[++i];
      if (next && slots.length) slots[slots.length - 1].alts.push(next.replace(/[()]/g, ""));
      continue;
    }
    if (t.startsWith("(")) {
      const inner = t.slice(1, -1).trim();
      if (inner) slots.push({ alts: [inner], optional: true });
      continue;
    }
    if (PLACEHOLDER.test(t) || t === "+") continue;
    slots.push({ alts: [t], optional: false });
  }
  const required = slots.filter((s) => !s.optional);
  if (!required.length) return null;
  const GAP = String.raw`(?:[\s,-]+\S+?){0,4}?[\s,-]*`;
  let src = "";
  slots.forEach((s, i) => {
    const alt = s.alts.map((a) => a.split(/[\s-]+/).map(wordPattern).join(String.raw`[\s-]*`)).join("|");
    const part = `(?:${alt})`;
    if (i === 0) src = s.optional ? `(?:${part}\\s+)?` : part;
    else src += s.optional ? `(?:${GAP}${part})?` : `${GAP}${part}`;
  });
  return new RegExp(`\\b${src}\\b`, "i");
}

/** Tách câu ví dụ thành [trước, đoạn khớp cụm, sau]; null nếu không tìm thấy cụm */
export function findPhrase(example: string, phrase: string): [string, string, string] | null {
  const m = phraseRegex(phrase)?.exec(example);
  if (!m) return null;
  return [example.slice(0, m.index), m[0], example.slice(m.index + m[0].length)];
}
