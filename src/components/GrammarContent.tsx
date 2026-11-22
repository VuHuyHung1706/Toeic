// Hiển thị nội dung bài ngữ pháp: đoạn văn, danh sách, bảng, mẹo, bẫy, ví dụ song ngữ, câu thật trong đề.
import type { ReactNode } from "react";
import type { Block } from "@/lib/grammar";
import type { GrammarExample } from "@/lib/grammar-examples";
import UiIcon from "./UiIcon";

/** **đậm**, *nghiêng*, ~~gạch~~, "____" hoặc "-----" (chỗ trống) */
export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|~~(.+?)~~|\*(.+?)\*|_{3,}|[-—]{3,}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={i++} className="font-semibold text-fg">{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<s key={i++} className="text-muted">{m[2]}</s>);
    else if (m[3] !== undefined) out.push(<em key={i++}>{m[3]}</em>);
    else out.push(<span key={i++} className="mx-0.5 inline-block w-14 border-b-2 border-primary align-middle" aria-label="chỗ trống" />);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function GrammarBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "p":
      return (
        <p className="leading-7 text-fg/90">
          <Inline text={block.text} />
        </p>
      );
    case "list":
      return (
        <ul className="space-y-2 leading-7">
          {block.items.map((t, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>
                <Inline text={t} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                {block.head.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-semibold">
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={i} className="border-t border-line align-top">
                  {r.map((c, j) => (
                    <td key={j} className={`px-3 py-2 leading-6 ${j === 0 ? "font-medium" : ""}`}>
                      <Inline text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "tip":
    case "trap": {
      const tip = block.kind === "tip";
      return (
        <div className={`flex gap-3 rounded-xl border p-4 leading-7 ${tip ? "border-primary/30 bg-primary-soft" : "border-warn/40 bg-warn-soft"}`}>
          <span className={`shrink-0 text-sm font-bold ${tip ? "text-primary" : "text-warn"}`}>{tip ? "Mẹo" : "Bẫy"}</span>
          <span>
            <Inline text={block.text} />
          </span>
        </div>
      );
    }
    case "examples":
      return (
        <div className="space-y-2">
          {block.items.map((e, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-3.5">
              <div className="leading-7">
                <Inline text={e.en} />
              </div>
              <div className="text-sm leading-6 text-vi">{e.vi}</div>
            </div>
          ))}
        </div>
      );
  }
}

/** Câu thật trong đề: tự chọn trước, bấm để xem đáp án và giải thích */
export function ExamExample({ ex, index }: { ex: GrammarExample; index: number }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface p-4 open:border-primary/40">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
          <span>
            Ví dụ {index + 1} · {ex.testTitle} · câu {ex.number}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            <span className="group-open:hidden">Xem đáp án</span>
            <span className="hidden group-open:inline">Ẩn đáp án</span>
            <UiIcon name="chevronDown" className="size-4 transition-transform group-open:rotate-180" />
          </span>
        </div>
        <div className="leading-7 font-medium">
          <Inline text={ex.question} />
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {(Object.entries(ex.options) as [string, string][]).map(([l, o]) => (
            <div
              key={l}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                l === ex.answer ? "border-line group-open:border-success group-open:bg-success-soft" : "border-line"
              }`}
            >
              <span className="font-bold text-muted">{l}</span>
              <span>{o}</span>
              {l === ex.answer && (
                <span className="ml-auto hidden text-success group-open:inline">
                  <UiIcon name="check" className="size-4" />
                </span>
              )}
            </div>
          ))}
        </div>
      </summary>
      {(ex.explanation || ex.translation) && (
        <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm leading-6">
          {ex.explanation && <p className="whitespace-pre-line">{ex.explanation}</p>}
          {ex.translation && <p className="text-vi">Dịch: {ex.translation}</p>}
        </div>
      )}
    </details>
  );
}
