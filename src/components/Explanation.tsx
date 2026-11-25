// Hiển thị lời giải đã được đọc thành khối (lib/explanation.ts): đáp án đúng nổi bật, đề mục nhỏ, trích dẫn có vạch,
// phân tích từng phương án (chữ cái + nhãn Sai/Đúng, ý con thụt vào), từ vựng dạng bảng hai cột.
import { Fragment, useMemo, type ReactNode } from "react";
import { parseExplanation, type Block, type ListItem } from "@/lib/explanation";
import UiIcon from "./UiIcon";

/** **đậm** → chữ đậm; phần còn lại giữ nguyên */
function Inline({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-fg">
            {p}
          </strong>
        ) : (
          <Fragment key={i}>{p.replace(/\*\*/g, "")}</Fragment>
        ),
      )}
    </>
  );
}

function Verdict({ v }: { v: ListItem["verdict"] }) {
  if (!v) return null;
  return v === "wrong" ? (
    <span className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
      <UiIcon name="close" className="size-3" />
      Sai
    </span>
  ) : (
    <span className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
      <UiIcon name="check" className="size-3" />
      Đúng
    </span>
  );
}

/** Bỏ đuôi "…: SAI vì:" khi đã có nhãn Sai/Đúng */
const trimVerdict = (t: string) => t.replace(/\s*[:–-]?\s*(?:SAI|ĐÚNG)(?:\s+vì)?\s*:?\s*$/u, "");

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </div>
  );
}

function BlockView({ b }: { b: Block }): ReactNode {
  switch (b.t) {
    case "answer":
      return (
        <div className="flex items-start gap-2 rounded-xl bg-success-soft px-3 py-2 text-fg">
          <UiIcon name="check" className="mt-0.5 size-4 text-success" />
          <div>
            <Inline text={b.text} />
          </div>
        </div>
      );
    case "sub":
      return <div className="pt-1 text-xs font-semibold text-fg">{b.text}</div>;
    case "quote":
      return (
        <blockquote className="border-l-2 border-primary/50 pl-3 text-fg italic">
          <Inline text={b.text} />
        </blockquote>
      );
    case "arrow":
      return (
        <div className="flex items-start gap-1.5">
          <UiIcon name="arrowRight" className="mt-1 size-3.5 text-primary" />
          <div>
            <Inline text={b.text} />
          </div>
        </div>
      );
    case "para":
      return (
        <p>
          {b.label && <span className="mr-1 font-semibold text-muted">{b.label}:</span>}
          <Inline text={b.text} />
        </p>
      );
    case "vocab":
      return (
        <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-1 rounded-xl bg-surface px-3 py-2">
          {b.items.map((v) => (
            <Fragment key={v.term}>
              <dt className="font-semibold text-fg">{v.term}</dt>
              <dd className="text-muted">{v.meaning}</dd>
            </Fragment>
          ))}
        </dl>
      );
    case "list":
      if (b.kind === "option") {
        return (
          <ul className="space-y-1.5">
            {b.items.map((it, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface px-3 py-2">
                <div className="flex items-start gap-2">
                  <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full border border-line text-[11px] font-bold text-muted">
                    {it.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Inline text={it.verdict ? trimVerdict(it.text) : it.text} />
                    <Verdict v={it.verdict} />
                  </div>
                </div>
                {it.children.length > 0 && (
                  <div className="mt-1.5 pl-7 text-muted">
                    <Blocks blocks={it.children} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        );
      }
      return (
        <ul className="space-y-1">
          {b.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2">
              {b.kind === "number" ? (
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
                  {it.label}
                </span>
              ) : (
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted/60" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <Inline text={it.text} />
                {it.children.length > 0 && (
                  <div className="mt-1 text-muted">
                    <Blocks blocks={it.children} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      );
  }
}

export default function Explanation({ text }: { text: string }) {
  const sections = useMemo(() => parseExplanation(text), [text]);
  return (
    <div className="space-y-4 leading-relaxed">
      {sections.map((s, i) => (
        <section key={i}>
          {s.heading && <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{s.heading}</h4>}
          <Blocks blocks={s.blocks} />
        </section>
      ))}
    </div>
  );
}
