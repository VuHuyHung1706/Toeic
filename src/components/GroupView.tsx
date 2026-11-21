"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import AudioPlayer from "./AudioPlayer";
import BilingualText from "./BilingualText";
import PassageView from "./PassageView";
import { renderBlanks } from "./BlankText";
import { HL_COLORS, highlightEvidence, highlightPair, jumpToEvidence, type EvidenceItem } from "./Evidence";
import { setPref, usePref } from "@/lib/storage";
import { isTextSelectGesture } from "@/lib/textSelection";
import { mediaUrl, optionLetters, partInfo } from "@/lib/toeic";
import type { Letter, Question, QuestionGroup } from "@/lib/types";
import SegmentedTabs from "./SegmentedTabs";

type View = "en" | "bilingual" | "vi";
const VIEWS: [View, string][] = [
  ["en", "Tiếng Anh"],
  ["bilingual", "Song ngữ"],
  ["vi", "Tiếng Việt"],
];

interface Props {
  group: QuestionGroup;
  answers: Record<number, Letter>;
  onSelect?: (n: number, l: Letter) => void;
  /** Câu nào đã được hiện đáp án + giải thích */
  isRevealed: (n: number) => boolean;
  /** Hiện script nghe (Part 1–4) — chỉ khi xem lại */
  showScript: boolean;
  showAudio: boolean;
  flagged?: Set<number>;
  onToggleFlag?: (n: number) => void;
  /**
   * Khoảng cách (px) từ mép trên màn hình tới chỗ cột transcript/bài đọc dính lại khi cuộn —
   * phải nằm dưới các thanh dính phía trên (menu, thanh phòng thi, thanh audio).
   */
  stickyTop?: number;
  /** Không có cột bài đọc/ảnh → câu hỏi nằm giữa, rộng vừa phải (phòng thi) */
  center?: boolean;
  /** Máy tính: hai khung cao bằng vùng chứa, mỗi khung tự cuộn (phòng luyện tập) */
  panes?: boolean;
}

export default function GroupView({
  group,
  answers,
  onSelect,
  isRevealed,
  showScript,
  showAudio,
  flagged,
  onToggleFlag,
  stickyTop,
  center,
  panes,
}: Props) {
  const [leftTab, setLeftTab] = useState<"script" | "vocab">("script");
  const view = usePref<View>("passageView", "bilingual");
  const part = group.part;
  const listening = part <= 4;
  const passages = group.passages.filter((p) => p.en || p.vi);
  const showPassages = passages.length > 0 && (!listening || showScript);
  const images = group.images.filter((i) => i.src);
  const hasLeft = images.length > 0 || showPassages;
  const allRevealed = group.questions.every((q) => isRevealed(q.number));
  const hasVi = passages.some((p) => p.vi);
  // Part 6: chỗ trống hiện thành nhãn số câu; đã chọn thì điền luôn đáp án, bấm để nhảy tới câu
  // Part 7: sau khi làm xong cả đoạn, tô dẫn chứng của mỗi câu một màu (màu của số câu)
  const hlClass = new Map<number, string>();
  if (part === 7 && allRevealed)
    group.questions.forEach((q, i) => {
      if (q.evidence?.length) hlClass.set(q.number, `hl-${(i % HL_COLORS) + 1}`);
    });
  const evidenceItems: EvidenceItem[] = group.questions
    .filter((q) => hlClass.has(q.number))
    .map((q) => ({ n: q.number, spans: q.evidence!, cls: hlClass.get(q.number)! }));
  const blanks = (text: string, lang: "en" | "vi" = "en", pairEn?: string): ReactNode =>
    part === 6
      ? renderBlanks(text, { questions: group.questions, answers, isRevealed, lang })
      : !evidenceItems.length
        ? text
        : lang === "en"
          ? highlightEvidence(text, evidenceItems)
          : pairEn
            ? highlightPair(text, pairEn, evidenceItems)
            : text;

  // Màn hình rộng (2 cột): cột trái dính lại và có thanh cuộn riêng, câu hỏi cuộn bên phải.
  // Mặc định: dưới menu (56px) + thanh audio dính của GroupView nếu có.
  const top = stickyTop ?? (showAudio && listening ? 128 : 72);
  // Part 3/4 đã chấm: script và từ vựng của đoạn nằm chung một khung, chuyển bằng tab
  const vocabTab = showPassages && allRevealed && listening && !!group.vocab?.length;
  const paneScroll = "lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-2";
  const left = hasLeft && (
    <div
      style={panes ? undefined : ({ "--sticky-top": `${top}px` } as CSSProperties)}
      className={`space-y-4 ${
        panes ? paneScroll : "lg:sticky lg:self-start lg:top-[var(--sticky-top)] lg:max-h-[calc(100vh-var(--sticky-top)-1rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
      }`}
    >
      {images.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.src}
          src={mediaUrl(img.src)!}
          alt={`Hình minh hoạ câu ${group.questionNumbers.join(", ")}`}
          className="mx-auto max-h-[460px] w-auto rounded-lg border border-line bg-white object-contain"
        />
      ))}
      {vocabTab && (
        <Tabs
          value={leftTab}
          onChange={setLeftTab}
          items={[
            ["script", "Script"],
            ["vocab", `Từ vựng (${group.vocab!.length})`],
          ]}
        />
      )}
      {vocabTab && leftTab === "vocab" && <GroupVocab items={group.vocab!} auto={!!group.vocabAuto} />}
      {showPassages && !(vocabTab && leftTab === "vocab") && (
        <div className={part >= 6 ? "" : "rounded-lg border border-line bg-surface p-4"}>
          {allRevealed && hasVi && (
            <SegmentedTabs
              label="Cách xem bài đọc"
              size="sm"
              className="mb-3"
              items={VIEWS.map(([id, label]) => ({ key: id, label }))}
              value={view}
              onChange={(id) => setPref("passageView", id)}
            />
          )}
          {part >= 6 &&
            passages.map((p, i) => (
              <div key={i} className={i ? "mt-4" : ""}>
                <PassageView
                  en={p.en || p.vi}
                  vi={p.en ? p.vi : ""}
                  view={allRevealed && p.vi ? view : "en"}
                  renderText={(s, lang, pairEn) => blanks(s, lang, pairEn)}
                />
              </div>
            ))}
          {part < 6 && passages.map((p, i) => (
            <div key={i} className={i ? "mt-4 border-t border-dashed border-line pt-4" : ""}>
              {allRevealed && view === "bilingual" && p.en && p.vi ? (
                <BilingualText en={p.en} vi={p.vi} renderText={blanks} />
              ) : (
                <div className="prose-pre text-[15px]">
                  {allRevealed && view === "vi" && p.vi ? blanks(p.vi, "vi") : blanks(p.en || p.vi)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`${center && !hasLeft ? "mx-auto max-w-3xl" : ""} ${panes ? "lg:flex lg:h-full lg:flex-col" : ""}`}>
      <div className="mb-3 flex shrink-0 flex-wrap items-baseline gap-x-3">
        <h2 className="text-lg font-semibold">
          Part {part} · {partInfo(part).name}
        </h2>
        <span className="text-sm text-muted">
          Câu {group.questionNumbers[0]}
          {group.questionNumbers.length > 1 && `–${group.questionNumbers[group.questionNumbers.length - 1]}`}
        </span>
      </div>
      {showAudio && listening && (
        // dính dưới thanh menu khi cuộn để luôn điều khiển được audio
        <div className="sticky top-0 z-10 mb-4 rounded-lg bg-surface/95 py-1.5 backdrop-blur sm:top-14">
          <AudioPlayer src={group.audio?.src ?? null} />
        </div>
      )}
      {/* Part 6/7: bài đọc chiếm ~60% bề ngang; các part khác chia đôi */}
      <div
        className={`${hasLeft ? `grid gap-6 ${part >= 6 ? "lg:grid-cols-[3fr_2fr]" : "lg:grid-cols-2"}` : ""} ${
          panes ? "lg:min-h-0 lg:flex-1" : ""
        }`}
      >
        {left}
        <div className={`space-y-5 ${panes ? paneScroll : ""}`}>
          {group.questions.map((q) => (
            <QuestionCard
              key={q.number}
              q={q}
              selected={answers[q.number]}
              onSelect={onSelect}
              revealed={isRevealed(q.number)}
              flagged={flagged?.has(q.number)}
              onToggleFlag={onToggleFlag}
              hlClass={hlClass.get(q.number)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  selected,
  onSelect,
  revealed,
  flagged,
  onToggleFlag,
  hlClass,
}: {
  q: Question;
  selected?: Letter;
  onSelect?: (n: number, l: Letter) => void;
  revealed: boolean;
  flagged?: boolean;
  onToggleFlag?: (n: number) => void;
  /** Màu dẫn chứng (Part 7) — số câu tô cùng màu với đoạn dẫn chứng trong bài */
  hlClass?: string;
}) {
  // Part 1–2: câu hỏi & đáp án chỉ được đọc trong audio, không in ra đề
  const spokenOnly = q.part <= 2;
  const showText = !spokenOnly || revealed;
  const questionText = q.part === 1 ? "" : q.question;
  const locked = !onSelect || revealed;
  // đáp án vừa bấm trong lần hiển thị này → chỉ phát hiệu ứng đúng/sai một lần, không phát lại khi quay lại câu cũ
  const [picked, setPicked] = useState<Letter | null>(null);
  const fresh = revealed && picked !== null;
  const pickedWrong = fresh && picked !== q.answer;

  return (
    <div
      id={`q-${q.number}`}
      // Part 7 đã chấm: viền trái cùng màu với dẫn chứng của câu
      style={hlClass ? { borderLeftColor: `var(--${hlClass})` } : undefined}
      className={`scroll-mt-24 rounded-xl border border-line bg-surface p-4 ${hlClass ? "border-l-[6px]" : ""}`}
    >
      <div className="flex items-start gap-3">
        {hlClass ? (
          <button
            type="button"
            onClick={() => jumpToEvidence(q.number)}
            title="Xem dẫn chứng trong bài đọc"
            className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-fg ring-1 ring-fg/20 ${hlClass}`}
          >
            {q.number}
          </button>
        ) : (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
            {q.number}
          </span>
        )}
        <div className="flex-1 pt-1 font-medium">
          {showText && questionText ? (
            hlClass ? (
              <mark className={`prose-pre rounded px-1 py-0.5 text-inherit [box-decoration-break:clone] ${hlClass}`}>{questionText}</mark>
            ) : (
              <span className="prose-pre">{questionText}</span>
            )
          ) : spokenOnly && !revealed ? (
            <span className="text-muted">{q.part === 1 ? "Chọn câu mô tả đúng nhất bức tranh." : "Nghe câu hỏi và chọn câu trả lời phù hợp."}</span>
          ) : null}
          {/* song ngữ: bản dịch câu hỏi, chỉ hiện khi đã có đáp án */}
          {revealed && showText && questionText && q.questionVi && (
            <div className="mt-1 text-sm font-normal text-vi">{q.questionVi}</div>
          )}
        </div>
        {onToggleFlag && (
          <button
            onClick={() => onToggleFlag(q.number)}
            title="Đánh dấu xem lại"
            aria-pressed={flagged}
            className={`rounded-md px-2 py-1 text-xs font-medium ${flagged ? "bg-warn-soft text-warn" : "text-muted hover:bg-surface-2"}`}
          >
            {flagged ? "★ Đã đánh dấu" : "☆ Đánh dấu"}
          </button>
        )}
      </div>

      {/* các phương án xếp dọc như máy thi (Part 1/2 khi chưa trả lời chỉ có chữ cái).
          Dùng khối role="radio" thay cho <button> để bôi đen / copy được chữ trong phương án. */}
      <div className="mt-3 grid gap-2" role="radiogroup" aria-label={`Câu ${q.number}`}>
        {optionLetters(q.part).map((L) => {
          const isSel = selected === L;
          const isAns = q.answer === L;
          let cls = locked ? "border-line" : "border-line hover:bg-surface-2";
          if (revealed && isAns) cls = "border-success bg-success-soft";
          else if (revealed && isSel) cls = "border-danger bg-danger-soft";
          else if (isSel) cls = "border-primary bg-primary-soft";
          // vòng chữ cái: đã có đáp án → xanh (đúng) / đỏ (chọn sai)
          let badge = isSel ? "border-primary bg-primary text-on-primary" : "border-line";
          if (revealed && isAns) badge = "border-success bg-success text-bg";
          else if (revealed && isSel) badge = "border-danger bg-danger text-bg";
          let anim = "";
          if (fresh && L === picked) anim = isAns ? "answer-pop" : "answer-shake";
          else if (pickedWrong && isAns) anim = "answer-reveal";
          const mark = revealed && (isAns || isSel) ? (isAns ? "✓" : "✗") : null;
          const choose = () => {
            if (locked) return;
            setPicked(L);
            onSelect?.(q.number, L);
          };
          return (
            <div
              key={L}
              role="radio"
              aria-checked={isSel}
              aria-disabled={locked}
              tabIndex={locked ? -1 : 0}
              onClick={(e) => {
                // kéo chuột / bấm đúp để bôi đen chữ trong phương án → chỉ copy, không chọn đáp án
                if (!isTextSelectGesture(e)) choose();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  choose();
                }
              }}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary ${
                locked ? "cursor-text" : "cursor-pointer"
              } ${cls} ${anim}`}
            >
              <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold ${badge}`}>
                {L}
              </span>
              {showText && (
                <span className="pt-0.5">
                  {q.options[L]}
                  {/* song ngữ: nghĩa (+ loại từ) của phương án, chỉ hiện khi đã có đáp án */}
                  {revealed && q.optionNotes?.[L] && (
                    <span className="mt-0.5 block text-sm text-vi">
                      {q.optionNotes[L]!.pos.length > 0 && (
                        // dấu cách thật (không chỉ margin) để copy ra "(n) nghĩa" thay vì "(n)nghĩa"
                        <span className="mr-0.5 text-xs font-semibold">({q.optionNotes[L]!.pos.join(", ")}) </span>
                      )}
                      {q.optionNotes[L]!.meaning}
                    </span>
                  )}
                </span>
              )}
              {mark && (
                <span
                  aria-hidden
                  className={`ml-auto shrink-0 pt-0.5 text-sm font-bold ${isAns ? "text-success" : "text-danger"} ${
                    fresh && (L === picked || isAns) ? "badge-in" : ""
                  }`}
                >
                  {mark}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {revealed && (
        <div className="mt-3 space-y-2">
          <div className={`text-sm ${fresh ? "step-fade" : ""}`}>
            {selected ? (
              selected === q.answer ? (
                <span className="font-semibold text-success">✓ Chính xác</span>
              ) : (
                <span className="font-semibold text-danger">
                  ✗ Bạn chọn {selected} — đáp án đúng là {q.answer}
                </span>
              )
            ) : (
              <span className="font-semibold text-warn">Chưa trả lời — đáp án đúng là {q.answer}</span>
            )}
          </div>
          {(q.explanation || q.transcript) && <ExplainBox q={q} />}
        </div>
      )}
    </div>
  );
}

/** Giải thích của một câu (bấm tiêu đề để ẩn/hiện); câu có lời đọc riêng thì thêm tab Script */
function ExplainBox({ q }: { q: Question }) {
  const [tab, setTab] = useState<"explain" | "script">("explain");
  const [open, setOpen] = useState(true);
  const items: [typeof tab, string][] = [["explain", "Giải thích"]];
  if (q.transcript) items.push(["script", "Script"]);
  const toggle = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-fg"
    >
      {open ? "Ẩn" : "Hiện"}
      <svg viewBox="0 0 20 20" className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} fill="currentColor" aria-hidden>
        <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06z" />
      </svg>
    </button>
  );
  return (
    <div className="rounded-lg bg-surface-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        {items.length > 1 && open ? (
          <div className="min-w-0 flex-1">
            <Tabs value={tab} onChange={setTab} items={items} small />
          </div>
        ) : (
          <button type="button" onClick={() => setOpen((o) => !o)} className="font-semibold">
            Giải thích
          </button>
        )}
        {toggle}
      </div>
      {open && <div className="prose-pre mt-2 leading-relaxed">{tab === "script" && q.transcript ? q.transcript : q.explanation}</div>}
    </div>
  );
}

/** Thanh tab nhỏ (gạch chân mục đang chọn) */
function Tabs<T extends string>({
  value,
  onChange,
  items,
  small,
}: {
  value: T;
  onChange: (v: T) => void;
  items: [T, string][];
  small?: boolean;
}) {
  // tab gạch chân, vạch xanh trượt sang tab vừa chọn
  return (
    <SegmentedTabs
      label="Chọn nội dung"
      variant="underline"
      size={small ? "sm" : "md"}
      className={small ? "-mx-1" : ""}
      items={items.map(([id, label]) => ({ key: id, label }))}
      value={value}
      onChange={onChange}
    />
  );
}

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* trình duyệt không hỗ trợ đọc */
  }
}

/** Từ vựng của đoạn hội thoại / bài nói (Part 3–4), hiện dưới transcript */
function GroupVocab({ items, auto }: { items: NonNullable<QuestionGroup["vocab"]>; auto: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">Từ vựng</h3>
        {auto && <span className="text-xs text-muted">tự động lấy từ lời thoại</span>}
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.map((v) => (
          <li key={v.term} className="flex flex-wrap items-baseline gap-x-2">
            <button onClick={() => speak(v.term)} className="font-semibold hover:text-primary" title="Nghe phát âm">
              {v.term}
            </button>
            {v.pos.length > 0 && <span className="text-xs text-muted">({v.pos.join(", ")})</span>}
            <span className="text-muted">{v.meaning}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
