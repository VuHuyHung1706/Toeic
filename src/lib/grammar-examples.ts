// Câu thật trong đề làm ví dụ cho bài ngữ pháp (chỉ dùng phía server, lúc dựng trang).
import type { GrammarTopic } from "./grammar";
import { getBank, getBankIndex } from "./tests";
import type { Letter } from "./types";

export interface GrammarExample {
  key: string;
  testTitle: string;
  number: number;
  question: string;
  options: Partial<Record<Letter, string>>;
  answer: Letter | null;
  explanation: string;
  translation: string;
}

/** Tách phần "Dịch: …" ở cuối lời giải thích */
function splitExplanation(text: string) {
  const i = text.search(/\n?\s*Dịch\s*:/);
  return i < 0 ? { explanation: text.trim(), translation: "" } : { explanation: text.slice(0, i).trim(), translation: text.slice(i).replace(/^\s*Dịch\s*:\s*/, "").trim() };
}

/** Tối đa `limit` câu khớp điều kiện của bài, rải đều trong danh sách (cố định giữa các lần dựng) */
export async function grammarExamples(topic: GrammarTopic, limit = 3): Promise<GrammarExample[]> {
  if (!topic.examples) return [];
  const seen = new Set<string>();
  const found: GrammarExample[] = [];
  for (const tag of topic.examples.tags) {
    for (const it of (await getBank("5", tag)) ?? []) {
      const q = it.group.questions[0];
      const key = `${it.testId}:${q.number}`;
      if (seen.has(key) || !q.answer || (topic.examples.match && !topic.examples.match(q))) continue;
      seen.add(key);
      found.push({ key, testTitle: it.testTitle, number: q.number, question: q.question, options: q.options, answer: q.answer, ...splitExplanation(q.explanation ?? "") });
    }
  }
  if (found.length <= limit) return found;
  return Array.from({ length: limit }, (_, i) => found[Math.floor((i * found.length) / limit)]);
}

/** Thông tin dạng câu Part 5 để nút "Luyện ngay" (tên dạng, số câu) */
export async function practiceInfo(tag: string | undefined) {
  if (!tag) return null;
  return (await getBankIndex()).find((t) => t.part === 5 && t.tag === tag) ?? null;
}
