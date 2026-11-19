"use client";
// Hiển thị bài đọc Part 7 thành HTML có cấu trúc: thẻ email/memo, khung chat, trang web, bảng, biểu mẫu, danh sách.
// Song ngữ: nếu bản dịch có cùng số dòng với bản gốc → dòng tiếng Việt (màu xanh) nằm ngay dưới từng dòng gốc;
// lệch dòng → quay về căn theo câu (BilingualText).

import { Fragment, useMemo, type ReactNode } from "react";
import BilingualText from "./BilingualText";
import {
  bulletText,
  parseChatHead,
  parseCheck,
  parseField,
  parseHeader,
  parsePassage,
  sameShape,
  splitDocs,
  splitMarkers,
  tableGrid,
  type Block,
  type PassageDoc,
} from "@/lib/passage";

type Lang = "en" | "vi";
export type RenderText = (s: string, lang: Lang, pairEn?: string) => ReactNode;

/** Ký hiệu vị trí chèn câu [1]…[4] */
function Marker({ n }: { n: number }) {
  return (
    <span
      title={`Vị trí [${n}]`}
      className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-primary/50 bg-primary-soft px-1 align-[1px] text-xs font-bold text-primary"
    >
      {n}
    </span>
  );
}

interface Ctx {
  render: RenderText;
  /** dòng bản dịch tương ứng (song ngữ theo dòng), hoặc null */
  pair: string[] | null;
  lang: Lang;
}

/** Một đoạn chữ: tách ký hiệu [n], phần chữ qua renderText (tô dẫn chứng / điền chỗ trống) */
function T({ text, lang, pairEn, ctx }: { text: string; lang: Lang; pairEn?: string; ctx: Ctx }) {
  return (
    <>
      {splitMarkers(text).map((seg, k) =>
        typeof seg === "string" ? <Fragment key={k}>{ctx.render(seg, lang, pairEn)}</Fragment> : <Marker key={k} n={seg.marker} />,
      )}
    </>
  );
}

/** Chữ gốc + (song ngữ) bản dịch ngay bên dưới */
function Bi({ en, vi, ctx }: { en: string; vi?: string | null; ctx: Ctx }) {
  return (
    <>
      <T text={en} lang={ctx.lang} ctx={ctx} />
      {vi && vi.trim() && vi.trim() !== en.trim() && (
        <span className="mt-0.5 block text-primary">
          <T text={vi} lang="vi" pairEn={en} ctx={ctx} />
        </span>
      )}
    </>
  );
}

function blockGap(b: Block, prev: Block | undefined) {
  if (!prev) return "";
  if (b.kind === "para" && b.compact && prev.kind === "para" && prev.compact) return "mt-0.5";
  if (b.kind === "chat" && prev.kind === "chat") return "mt-2";
  if (b.kind === "heading" && b.level === 2) return "mt-4";
  return "mt-3";
}

function BlockView({ b, doc, ctx }: { b: Block; doc: PassageDoc; ctx: Ctx }) {
  const L = doc.lines;
  const P = (i: number) => ctx.pair?.[i] ?? null;
  switch (b.kind) {
    case "url":
      return null; // vẽ ở thanh địa chỉ của DocCard
    case "label":
      return (
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">
          <Bi en={L[b.i].trim()} vi={P(b.i)} ctx={ctx} />
        </p>
      );
    case "nav":
      return (
        <nav className="-mx-4 -mt-4 mb-1 flex flex-wrap gap-x-4 gap-y-1 border-b border-line bg-surface-2/60 px-4 py-2 text-sm font-medium text-muted">
          {b.rows
            .flatMap((i) => L[i].split(/\s*\|\s*|\s{3,}/))
            .filter(Boolean)
            .map((item, k) => (
              <span key={k}>{item.replace(/\.$/, "")}</span>
            ))}
        </nav>
      );
    case "heading":
      return b.level === 1 ? (
        <h3 className="text-lg leading-snug font-bold">
          <Bi en={L[b.i].trim()} vi={P(b.i)} ctx={ctx} />
        </h3>
      ) : (
        <h4 className="font-semibold tracking-wide">
          <Bi en={L[b.i].trim()} vi={P(b.i)} ctx={ctx} />
        </h4>
      );
    case "headers":
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-surface-2 px-3 py-2 text-sm">
          {b.rows.map((i) => {
            const h = parseHeader(L[i].trim())!;
            const pv = P(i);
            const hv = pv ? parseHeader(pv.trim()) : null;
            return (
              <Fragment key={i}>
                <dt className="font-semibold text-muted">{h.label}:</dt>
                <dd className="min-w-0 break-words">
                  <Bi en={h.value} vi={hv ? hv.value : pv} ctx={ctx} />
                </dd>
              </Fragment>
            );
          })}
        </dl>
      );
    case "fields":
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
          {b.rows.map((i) => {
            const f = parseField(L[i].trim());
            const pv = P(i);
            const fv = pv ? parseField(pv.trim()) : null;
            return f ? (
              <Fragment key={i}>
                <dt className="font-semibold">
                  <Bi en={f.label} vi={fv?.label} ctx={ctx} />
                </dt>
                <dd className="min-w-0 break-words">
                  <Bi en={f.value} vi={fv ? fv.value : pv} ctx={ctx} />
                </dd>
              </Fragment>
            ) : (
              // dòng nối (vd địa chỉ nhiều dòng) — nằm ở cột giá trị
              <dd key={i} className="col-start-2 min-w-0 break-words">
                <Bi en={L[i].trim()} vi={pv?.trim()} ctx={ctx} />
              </dd>
            );
          })}
        </dl>
      );
    case "list":
      return (
        <ul className="list-disc space-y-1 pl-6 marker:text-muted">
          {b.items.map((i) => (
            <li key={i}>
              <Bi en={bulletText(L[i])} vi={P(i) ? bulletText(P(i)!) : null} ctx={ctx} />
            </li>
          ))}
        </ul>
      );
    case "checklist":
      return (
        <ul className="space-y-1">
          {b.items.map((i) => {
            const c = parseCheck(L[i].trim())!;
            const pv = P(i);
            return (
              <li key={i} className="flex items-start gap-2">
                <span
                  aria-label={c.checked ? "đã chọn" : "chưa chọn"}
                  className={`mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded-sm border text-[11px] leading-none font-bold ${c.checked ? "border-fg bg-fg text-bg" : "border-muted"}`}
                >
                  {c.checked ? "✓" : ""}
                </span>
                <span>
                  <Bi en={c.text} vi={pv ? (parseCheck(pv.trim())?.text ?? pv) : null} ctx={ctx} />
                </span>
              </li>
            );
          })}
        </ul>
      );
    case "table": {
      const grid = tableGrid(b.rows.map((i) => L[i]));
      const viGrid = ctx.pair ? tableGrid(b.rows.map((i) => ctx.pair![i] ?? ""), b.rows.map((i) => L[i])) : null;
      const sameGrid = viGrid && viGrid.length === grid.length && viGrid.every((r, k) => r.length === grid[k].length);
      const head = grid.length >= 2 && grid[0].every((c) => c && !/\d/.test(c));
      const table = (g: string[][], vg: string[][] | null, cls = "") => (
        <div className={`overflow-x-auto ${cls}`}>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {g.map((row, r) => (
                <tr key={r} className={head && r === 0 ? "bg-surface-2 font-semibold" : "border-t border-line"}>
                  {row.map((cell, c) => (
                    <td key={c} className="border border-line px-2.5 py-1.5 align-top">
                      <Bi en={cell} vi={vg?.[r]?.[c]} ctx={ctx} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      if (!viGrid || sameGrid) return table(grid, sameGrid ? viGrid : null);
      // bản dịch không chia được đúng ô → bảng gốc rồi tới bản dịch từng dòng
      return (
        <div>
          {table(grid, null)}
          <div className="mt-2 space-y-0.5 text-sm text-primary">
            {b.rows.map((i) => ctx.pair![i]?.trim() && <p key={i}><T text={ctx.pair![i].trim()} lang="vi" pairEn={L[i]} ctx={ctx} /></p>)}
          </div>
        </div>
      );
    }
    case "chat": {
      const h = parseChatHead(L[b.head].trim())!;
      const pv = P(b.head);
      const hv = pv ? parseChatHead(pv.trim()) : null;
      const speakers = [...new Set(doc.blocks.filter((x) => x.kind === "chat").map((x) => parseChatHead(L[(x as { head: number }).head].trim())!.name))];
      const right = speakers.indexOf(h.name) % 2 === 1;
      const body = [...(h.rest ? [{ en: h.rest, vi: hv?.rest ?? null }] : []), ...b.body.map((i) => ({ en: L[i].trim(), vi: P(i) }))];
      return (
        <div className={`flex flex-col ${right ? "items-end" : "items-start"}`}>
          <p className="mb-0.5 px-1 text-xs text-muted">
            <b className="text-fg">{h.name}</b> · {h.time}
          </p>
          <div
            className={`max-w-[92%] space-y-1 rounded-2xl px-3.5 py-2 text-[15px] ${right ? "rounded-tr-sm bg-primary-soft" : "rounded-tl-sm bg-surface-2"}`}
          >
            {body.map((x, k) => (
              <p key={k}>
                <Bi en={x.en} vi={x.vi} ctx={ctx} />
              </p>
            ))}
          </div>
        </div>
      );
    }
    case "para":
      return (
        <p className={b.compact ? "" : "leading-relaxed"}>
          <Bi en={L[b.i].trim()} vi={P(b.i)?.trim()} ctx={ctx} />
        </p>
      );
  }
}

const KIND_LABEL: Record<PassageDoc["kind"], string> = { email: "Email", chat: "Tin nhắn", web: "Trang web", doc: "" };

function DocCard({ doc, ctx }: { doc: PassageDoc; ctx: Ctx }) {
  const url = doc.blocks[0]?.kind === "url" ? doc.lines[(doc.blocks[0] as { i: number }).i].trim() : null;
  const blocks = doc.blocks.filter((b) => b.kind !== "url");
  return (
    <article
      data-doc-kind={doc.kind}
      className="overflow-hidden rounded-lg border border-line bg-surface text-[15px] shadow-xs"
    >
      {url && (
        <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-1.5 text-xs text-muted">
          <span className="flex gap-1" aria-hidden>
            <i className="size-2 rounded-full bg-danger/60" />
            <i className="size-2 rounded-full bg-warn/60" />
            <i className="size-2 rounded-full bg-success/60" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-0.5 font-mono">{url}</span>
        </div>
      )}
      {doc.kind === "chat" && (
        <div className="border-b border-line bg-surface-2 px-4 py-1.5 text-xs font-semibold tracking-wider text-muted uppercase">
          💬 {KIND_LABEL.chat}
        </div>
      )}
      <div className="p-4">
        {blocks.map((b, k) => (
          <div key={k} className={blockGap(b, blocks[k - 1])}>
            <BlockView b={b} doc={doc} ctx={ctx} />
          </div>
        ))}
      </div>
    </article>
  );
}

export default function PassageView({
  en,
  vi,
  view,
  renderText,
}: {
  en: string;
  vi: string;
  /** "en": chỉ bản gốc · "vi": chỉ bản dịch · "bilingual": song ngữ */
  view: "en" | "vi" | "bilingual";
  renderText: RenderText;
}) {
  const docs = useMemo(() => parsePassage(view === "vi" && vi ? vi : en), [view, en, vi]);
  const aligned = useMemo(() => view === "bilingual" && !!vi && sameShape(en, vi), [view, en, vi]);
  const viDocs = useMemo(() => (aligned ? splitDocs(vi) : null), [aligned, vi]);

  // song ngữ nhưng lệch dòng → căn theo câu như cũ, vẫn chia theo từng văn bản nếu số văn bản khớp
  if (view === "bilingual" && vi && !aligned) {
    const enParts = en.split(/^\s*={3,}\s*$/m);
    const viParts = vi.split(/^\s*={3,}\s*$/m);
    const pairs = enParts.length === viParts.length ? enParts.map((e, k) => [e, viParts[k]]) : [[en, vi]];
    return (
      <div className="space-y-4">
        {pairs.map(([e, v], k) => (
          <article key={k} className="rounded-lg border border-line bg-surface p-4">
            <BilingualText en={e.trim()} vi={v.trim()} renderText={(s, lang, pairEn) => renderMarkers(s, lang, pairEn, renderText)} />
          </article>
        ))}
      </div>
    );
  }

  const lang: Lang = view === "vi" && vi ? "vi" : "en";
  return (
    <div className="space-y-4">
      {docs.map((doc, k) => (
        <DocCard key={k} doc={doc} ctx={{ render: renderText, pair: viDocs?.[k] ?? null, lang }} />
      ))}
    </div>
  );
}

function renderMarkers(s: string, lang: Lang, pairEn: string | undefined, render: RenderText): ReactNode {
  return splitMarkers(s).map((seg, k) =>
    typeof seg === "string" ? <Fragment key={k}>{render(seg, lang, pairEn)}</Fragment> : <Marker key={k} n={seg.marker} />,
  );
}
