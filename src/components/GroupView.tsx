"use client";

import { useState } from "react";
import AudioPlayer from "./AudioPlayer";
import { mediaUrl, optionLetters, partInfo } from "@/lib/toeic";
import type { Letter, Question, QuestionGroup } from "@/lib/types";

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
}

export default function GroupView({ group, answers, onSelect, isRevealed, showScript, showAudio, flagged, onToggleFlag }: Props) {
  const [showVi, setShowVi] = useState(false);
  const part = group.part;
  const listening = part <= 4;
  const passages = group.passages.filter((p) => p.en || p.vi);
  const showPassages = passages.length > 0 && (!listening || showScript);
  const images = group.images.filter((i) => i.src);
  const hasLeft = images.length > 0 || showPassages;
  const allRevealed = group.questions.every((q) => isRevealed(q.number));

  const left = hasLeft && (
    <div className={`space-y-4 ${part >= 6 ? "lg:sticky lg:top-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto" : ""}`}>
      {images.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.src}
          src={mediaUrl(img.src)!}
          alt={`Hình minh hoạ câu ${group.questionNumbers.join(", ")}`}
          className="mx-auto max-h-[460px] w-auto rounded-lg border border-line bg-white object-contain"
        />
      ))}
      {showPassages && (
        <div className="rounded-lg border border-line bg-surface p-4">
          {allRevealed && passages.some((p) => p.vi) && (
            <div className="mb-3 flex gap-1 text-sm">
              {(["Tiếng Anh", "Bản dịch"] as const).map((label, i) => (
                <button
                  key={label}
                  onClick={() => setShowVi(i === 1)}
                  className={`rounded-md px-3 py-1 ${showVi === (i === 1) ? "bg-primary-soft font-semibold text-primary" : "text-muted hover:bg-surface-2"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {passages.map((p, i) => (
            <div key={i} className={i ? "mt-4 border-t border-dashed border-line pt-4" : ""}>
              <div className="prose-pre text-[15px]">{(allRevealed && showVi ? p.vi || p.en : p.en) || p.vi}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-lg font-semibold">
          Part {part} · {partInfo(part).name}
        </h2>
        <span className="text-sm text-muted">
          Câu {group.questionNumbers[0]}
          {group.questionNumbers.length > 1 && `–${group.questionNumbers[group.questionNumbers.length - 1]}`}
        </span>
      </div>
      {showAudio && listening && (
        <div className="mb-4">
          <AudioPlayer src={group.audio?.src ?? null} />
        </div>
      )}
      <div className={hasLeft ? "grid gap-6 lg:grid-cols-2" : ""}>
        {left}
        <div className="space-y-5">
          {group.questions.map((q) => (
            <QuestionCard
              key={q.number}
              q={q}
              selected={answers[q.number]}
              onSelect={onSelect}
              revealed={isRevealed(q.number)}
              flagged={flagged?.has(q.number)}
              onToggleFlag={onToggleFlag}
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
}: {
  q: Question;
  selected?: Letter;
  onSelect?: (n: number, l: Letter) => void;
  revealed: boolean;
  flagged?: boolean;
  onToggleFlag?: (n: number) => void;
}) {
  // Part 1–2: câu hỏi & đáp án chỉ được đọc trong audio, không in ra đề
  const spokenOnly = q.part <= 2;
  const showText = !spokenOnly || revealed;
  const questionText = q.part === 1 ? "" : q.question;
  const locked = !onSelect || revealed;

  return (
    <div id={`q-${q.number}`} className="scroll-mt-24 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
          {q.number}
        </span>
        <div className="flex-1 pt-1 font-medium">
          {showText && questionText ? <span className="prose-pre">{questionText}</span> : spokenOnly && !revealed ? (
            <span className="text-muted">{q.part === 1 ? "Chọn câu mô tả đúng nhất bức tranh." : "Nghe câu hỏi và chọn câu trả lời phù hợp."}</span>
          ) : null}
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

      <div className={`mt-3 grid gap-2 ${spokenOnly && !revealed ? "grid-cols-4" : ""}`}>
        {optionLetters(q.part).map((L) => {
          const isSel = selected === L;
          const isAns = q.answer === L;
          let cls = "border-line hover:bg-surface-2";
          if (revealed && isAns) cls = "border-success bg-success-soft";
          else if (revealed && isSel) cls = "border-danger bg-danger-soft";
          else if (isSel) cls = "border-primary bg-primary-soft";
          return (
            <button
              key={L}
              disabled={locked}
              onClick={() => onSelect?.(q.number, L)}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-default ${cls} ${
                spokenOnly && !revealed ? "justify-center" : ""
              }`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                  isSel ? "border-primary bg-primary text-on-primary" : "border-line"
                }`}
              >
                {L}
              </span>
              {showText && <span className="pt-0.5">{q.options[L]}</span>}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="mt-3 space-y-2">
          <div className="text-sm">
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
          {(q.explanation || q.transcript) && (
            <details open className="rounded-lg bg-surface-2 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Giải thích</summary>
              {q.transcript && <div className="prose-pre mt-2 text-muted">{q.transcript}</div>}
              <div className="prose-pre mt-2">{q.explanation}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
