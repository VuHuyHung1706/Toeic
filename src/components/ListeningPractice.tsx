"use client";

import { useMemo, useRef, useState } from "react";
import AudioPlayer from "./AudioPlayer";
import BilingualText from "./BilingualText";
import { LEVELS, buildTokens, diffWords, hintOf, normalizeWord, scriptLines, type Level } from "@/lib/dictation";
import { recordDictation } from "@/lib/storage";
import { PARTS } from "@/lib/toeic";
import { useTests } from "@/lib/useTests";
import type { PartNo, QuestionGroup } from "@/lib/types";

type TestRef = { id: string; year: number; number: number };
const LISTEN_PARTS: PartNo[] = [1, 2, 3, 4];

export default function ListeningPractice({ tests }: { tests: TestRef[] }) {
  const years = [...new Set(tests.map((t) => t.year))].sort((a, b) => b - a);
  const [testId, setTestId] = useState(tests.find((t) => t.year === years[0])?.id ?? tests[0].id);
  const [part, setPart] = useState<PartNo>(3);
  const [level, setLevel] = useState<Level>("medium");
  const [groupIndex, setGroupIndex] = useState(0);
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<"fill" | "full">("fill");
  const { tests: loaded, loading, error } = useTests([testId]);
  const test = loaded[testId];
  const groups = useMemo(
    () => (test?.parts.find((p) => p.part === part)?.groups ?? []).filter((g) => g.audio?.src),
    [test, part],
  );
  const group = groups[Math.min(groupIndex, groups.length - 1)];

  const pick = (fn: () => void) => {
    fn();
    setGroupIndex(0);
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-line bg-surface p-4">
        <label className="text-sm">
          <div className="mb-1 text-muted">Đề</div>
          <select
            value={testId}
            onChange={(e) => pick(() => setTestId(e.target.value))}
            className="rounded-md border border-line bg-surface px-2 py-1.5"
          >
            {years.map((y) => (
              <optgroup key={y} label={`ETS ${y}`}>
                {tests
                  .filter((t) => t.year === y)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      ETS {y} · Test {t.number}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <Segmented
          label="Part"
          value={part}
          options={LISTEN_PARTS.map((p) => ({ value: p, label: `${p}`, title: PARTS[p - 1].name }))}
          onChange={(p) => pick(() => setPart(p))}
        />
        <Segmented
          label="Chế độ"
          value={mode}
          options={[
            { value: "fill", label: "Điền từ" },
            { value: "full", label: "Chép cả câu" },
          ]}
          onChange={setMode}
        />
        {mode === "fill" && (
          <>
            <Segmented label="Độ khó" value={level} options={LEVELS.map((l) => ({ value: l.id, label: l.label }))} onChange={setLevel} />
            <button onClick={() => setSeed((s) => s + 1)} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
              ↻ Đổi chỗ trống
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-6 text-danger">{error}</p>}
      {loading && <p className="mt-6 text-muted">Đang tải đề…</p>}
      {!loading && !group && <p className="mt-6 text-muted">Part này của đề chưa có audio.</p>}

      {group && test && (
        <>
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              disabled={groupIndex === 0}
              onClick={() => setGroupIndex(groupIndex - 1)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ← Trước
            </button>
            <div className="text-sm text-muted">
              Part {part} · {group.questionNumbers.length > 1 ? `Câu ${group.questionNumbers[0]}–${group.questionNumbers.at(-1)}` : `Câu ${group.questionNumbers[0]}`} ·{" "}
              {groupIndex + 1}/{groups.length}
            </div>
            <button
              disabled={groupIndex >= groups.length - 1}
              onClick={() => setGroupIndex(groupIndex + 1)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Tiếp →
            </button>
          </div>
          {mode === "fill" ? (
            <DictationCard
              key={`${group.id}:${level}:${seed}`}
              testId={test.id}
              group={group}
              level={level}
              seed={seed}
              onNext={groupIndex < groups.length - 1 ? () => setGroupIndex(groupIndex + 1) : undefined}
            />
          ) : (
            <FullDictationCard
              key={group.id}
              testId={test.id}
              group={group}
              onNext={groupIndex < groups.length - 1 ? () => setGroupIndex(groupIndex + 1) : undefined}
            />
          )}
        </>
      )}
    </div>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="text-sm">
      <div className="mb-1 text-muted">{label}</div>
      <div className="inline-flex rounded-md border border-line p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`rounded px-3 py-1 ${value === o.value ? "bg-primary text-on-primary" : "hover:bg-surface-2"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DictationCard({
  testId,
  group,
  level,
  seed,
  onNext,
}: {
  testId: string;
  group: QuestionGroup;
  level: Level;
  seed: number;
  onNext?: () => void;
}) {
  const lines = useMemo(() => scriptLines(group), [group]);
  const tokens = useMemo(() => buildTokens(lines, level, seed), [lines, level, seed]);
  const blanks = tokens.flat().filter((t) => t.kind === "blank");
  const [values, setValues] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const recorded = useRef(false);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});

  const isRight = (id: number, answer: string) => normalizeWord(values[id] ?? "") === normalizeWord(answer);
  const correct = blanks.filter((b) => isRight(b.id, b.answer)).length;

  const check = () => {
    setChecked(true);
    if (!recorded.current && blanks.length) {
      recorded.current = true;
      recordDictation({ testId, groupId: group.id, correct, total: blanks.length });
    }
  };

  const translation =
    group.part >= 3
      ? group.passages.map((p) => p.vi).filter(Boolean).join("\n\n")
      : group.questions[0]?.explanation ?? "";

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-5">
      <div className="sticky top-0 z-10 -mx-2 bg-surface/95 px-2 py-1.5 backdrop-blur sm:top-14">
        <AudioPlayer src={group.audio?.src ?? null} />
      </div>

      <div className="mt-5 space-y-3 text-[17px] leading-10">
        {tokens.map((line, li) => (
          <p key={li}>
            {lines[li].label && <span className="mr-2 font-semibold text-muted">{lines[li].label}</span>}
            {line.map((t, ti) => {
              if (t.kind === "text") return <span key={ti}>{t.text}</span>;
              const ok = isRight(t.id, t.answer);
              const state = revealed ? "reveal" : checked ? (ok ? "ok" : "bad") : "idle";
              return (
                <span key={ti} className="inline-block">
                  <span>
                    {t.before}
                    <input
                      ref={(el) => {
                        inputs.current[t.id] = el;
                      }}
                      value={revealed ? t.answer : values[t.id] ?? ""}
                      readOnly={revealed}
                      onChange={(e) => {
                        setValues((v) => ({ ...v, [t.id]: e.target.value }));
                        if (checked) setChecked(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const next = inputs.current[t.id + 1];
                        if (next) next.focus();
                        else check();
                      }}
                      aria-label={`Chỗ trống ${t.id + 1}`}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      style={{ width: `${Math.max(3, t.answer.length) + 1.5}ch` }}
                      className={`mx-0.5 rounded-md border-b-2 px-1 text-center outline-none focus:bg-primary-soft ${
                        state === "ok"
                          ? "border-success bg-success-soft text-success"
                          : state === "bad"
                            ? "border-danger bg-danger-soft text-danger"
                            : state === "reveal"
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-line bg-surface-2"
                      }`}
                    />
                    {state === "bad" && <span className="mr-0.5 text-sm font-semibold text-success">→ {t.answer}</span>}
                    {t.after}
                  </span>
                </span>
              );
            })}
          </p>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={check} className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:opacity-90">
          Kiểm tra
        </button>
        <button onClick={() => setRevealed((r) => !r)} className="rounded-lg border border-line px-4 py-2 font-medium hover:bg-surface-2">
          {revealed ? "Ẩn đáp án" : "Hiện đáp án"}
        </button>
        <button
          onClick={() => {
            setValues({});
            setChecked(false);
            setRevealed(false);
            inputs.current[0]?.focus();
          }}
          className="rounded-lg border border-line px-4 py-2 font-medium hover:bg-surface-2"
        >
          Xoá
        </button>
        {checked && (
          <span className={`text-sm font-semibold ${correct === blanks.length ? "text-success" : "text-fg"}`}>
            Đúng {correct}/{blanks.length} từ
          </span>
        )}
        {onNext && (checked || revealed) && (
          <button onClick={onNext} className="ml-auto rounded-lg border border-line px-4 py-2 font-medium hover:bg-surface-2">
            Đoạn tiếp →
          </button>
        )}
      </div>

      {(checked || revealed) && translation && (
        <details className="mt-5 rounded-lg bg-surface-2 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">{group.part >= 3 ? "Song ngữ Anh – Việt" : "Dịch & giải thích"}</summary>
          {group.part >= 3 ? (
            <div className="mt-3 space-y-4">
              {group.passages
                .filter((p) => p.en && p.vi)
                .map((p, i) => (
                  <BilingualText key={i} en={p.en} vi={p.vi} />
                ))}
            </div>
          ) : (
            <div className="prose-pre mt-2">{translation}</div>
          )}
        </details>
      )}
      <p className="mt-4 text-xs text-muted">Mẹo: nhấn Enter để chuyển sang chỗ trống tiếp theo; Enter ở ô cuối để kiểm tra.</p>
    </div>
  );
}

function FullDictationCard({ testId, group, onNext }: { testId: string; group: QuestionGroup; onNext?: () => void }) {
  const lines = useMemo(() => scriptLines(group), [group]);
  const [values, setValues] = useState<string[]>(() => lines.map(() => ""));
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState<Set<number>>(new Set());
  const recorded = useRef(false);

  const results = lines.map((l, i) => diffWords(l.text, values[i] ?? ""));
  const correct = results.reduce((s, r) => s + r.correct, 0);
  const total = results.reduce((s, r) => s + r.total, 0);

  const check = () => {
    setChecked(true);
    if (!recorded.current) {
      recorded.current = true;
      recordDictation({ testId, groupId: group.id, correct, total });
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-5">
      <div className="sticky top-0 z-10 -mx-2 bg-surface/95 px-2 py-1.5 backdrop-blur sm:top-14">
        <AudioPlayer src={group.audio?.src ?? null} />
      </div>
      <p className="mt-3 text-sm text-muted">
        Nghe và chép lại từng dòng ({lines.length} dòng). Không cần chính xác dấu câu và chữ hoa.
      </p>

      <div className="mt-4 space-y-4">
        {lines.map((l, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center gap-2 text-sm">
              <span className="font-semibold text-muted">{l.label ?? `Dòng ${i + 1}`}</span>
              <button
                onClick={() => setHints((h) => new Set(h).add(i))}
                disabled={hints.has(i)}
                className="text-xs text-primary hover:underline disabled:text-muted disabled:no-underline"
              >
                {hints.has(i) ? "Đã hiện gợi ý" : "Gợi ý"}
              </button>
              {checked && (
                <span className={`ml-auto text-xs font-semibold ${results[i].correct === results[i].total ? "text-success" : "text-muted"}`}>
                  {results[i].correct}/{results[i].total} từ
                </span>
              )}
            </div>
            {hints.has(i) && <div className="mb-1 font-mono text-sm tracking-wide text-muted">{hintOf(l.text)}</div>}
            <textarea
              value={values[i]}
              onChange={(e) => {
                const v = e.target.value;
                setValues((arr) => arr.map((x, j) => (j === i ? v : x)));
                if (checked) setChecked(false);
              }}
              rows={Math.min(4, Math.max(1, Math.ceil(l.text.length / 80)))}
              spellCheck={false}
              autoCapitalize="off"
              aria-label={`Chép dòng ${i + 1}`}
              className="w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-[15px] outline-none focus:border-primary"
            />
            {checked && (
              <div className="mt-1 text-[15px] leading-7">
                {results[i].ops.map((o, k) => (
                  <span
                    key={k}
                    className={
                      o.type === "ok"
                        ? "text-success"
                        : o.type === "miss"
                          ? "rounded bg-danger-soft px-0.5 text-danger underline decoration-dotted"
                          : "text-muted line-through"
                    }
                  >
                    {o.text}{" "}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={check} className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:opacity-90">
          Kiểm tra
        </button>
        {checked && (
          <span className="text-sm font-semibold">
            Đúng {correct}/{total} từ ({total ? Math.round((correct / total) * 100) : 0}%)
          </span>
        )}
        {checked && (
          <span className="text-xs text-muted">
            <span className="text-success">xanh</span> = đúng · <span className="text-danger">đỏ</span> = thiếu/sai ·{" "}
            <span className="line-through">gạch</span> = thừa
          </span>
        )}
        {onNext && checked && (
          <button onClick={onNext} className="ml-auto rounded-lg border border-line px-4 py-2 font-medium hover:bg-surface-2">
            Đoạn tiếp →
          </button>
        )}
      </div>

      {checked && (
        <details className="mt-5 rounded-lg bg-surface-2 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">{group.part >= 3 ? "Song ngữ Anh – Việt" : "Dịch & giải thích"}</summary>
          {group.part >= 3 ? (
            <div className="mt-3 space-y-4">
              {group.passages
                .filter((p) => p.en && p.vi)
                .map((p, i) => (
                  <BilingualText key={i} en={p.en} vi={p.vi} />
                ))}
            </div>
          ) : (
            <div className="prose-pre mt-2">{group.questions[0]?.explanation}</div>
          )}
        </details>
      )}
    </div>
  );
}
