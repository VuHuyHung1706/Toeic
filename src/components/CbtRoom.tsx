"use client";
// Giao diện thi thật mô phỏng máy thi TOEIC trên máy tính (IIG):
// thanh trên xanh navy (tiêu đề "Listening/Reading: Questions … of 200", loa, số câu đã làm, đồng hồ, Submit),
// hai khung: trái = hướng dẫn + ảnh/bài đọc, phải = câu hỏi với nút tròn (A)(B)(C)(D);
// Reading có thanh dưới: "Mark item for review", danh sách câu, trước/sau. Nộp bài → hộp NOTIFICATION.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { renderBlanks } from "./BlankText";
import ConfirmDialog, { ExitIcon } from "./ConfirmDialog";
import PassageView from "./PassageView";
import { isTextSelectGesture } from "@/lib/textSelection";
import { formatDuration, mediaUrl, optionLetters } from "@/lib/toeic";
import type { Letter, PartNo, QuestionGroup } from "@/lib/types";
import Logo from "./Logo";
import SmoothWidth from "./SmoothWidth";

const INSTRUCTIONS: Record<PartNo, string> = {
  1: "Select the one statement that best describes what you see in the picture.",
  2: "Select the best response to the question or statement.",
  3: "Select the best response to each question.",
  4: "Select the best response to each question.",
  5: "Select the best answer to complete the sentence.",
  6: "Select the best answer to complete the text.",
  7: "Select the best answer for each question.",
};

/** Lời hướng dẫn ngắn hiển thị khi audio đang đọc phần Directions của mỗi part (tự viết, không chép đề gốc) */
const DIRECTIONS: Record<1 | 2 | 3 | 4, string> = {
  1: "For each question, you will hear four statements about a picture. Select the one statement that best describes what you see in the picture. The statements will be spoken only one time.",
  2: "You will hear a question or statement and three responses. Select the best response. The question and responses will be spoken only one time.",
  3: "You will hear some conversations between two or more people. Answer three questions about what the speakers say in each conversation. The conversations will be spoken only one time.",
  4: "You will hear some talks given by a single speaker. Answer three questions about what the speaker says in each talk. The talks will be spoken only one time.",
};

export interface CbtProps {
  testId: string;
  groups: QuestionGroup[];
  groupIndex: number;
  /** "listening" khi đang ở nhóm Part 1–4 */
  section: "listening" | "reading";
  /** audio đang đọc phần hướng dẫn của part này (chưa tới câu đầu) */
  directionsPart: PartNo | null;
  /** phần nghe tự chạy theo audio → không cho chuyển câu bằng tay */
  locked: boolean;
  answers: Record<number, Letter>;
  onSelect: (n: number, l: Letter) => void;
  flagged: Set<number>;
  onSetFlags: (numbers: number[], on: boolean) => void;
  answered: number;
  total: number;
  remaining: number | null;
  volume: number;
  onVolume: (v: number) => void;
  audioBlocked: boolean;
  onPlayAudio: () => void;
  onGo: (groupIndex: number, n?: number) => void;
  /** chỉ số nhóm được phép tới (Reading khi phần nghe đang khoá) */
  canGo: (groupIndex: number) => boolean;
  onSubmit: () => void;
  submitting: boolean;
}

const range = (g: QuestionGroup) => {
  const a = g.questionNumbers[0];
  const b = g.questionNumbers[g.questionNumbers.length - 1];
  return a === b ? `${a}` : `${a} - ${b}`;
};

export default function CbtRoom(p: CbtProps) {
  const { groups, groupIndex, section, directionsPart, answers } = p;
  const group = groups[groupIndex];
  const [soundOpen, setSoundOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const router = useRouter();

  // Esc: đóng hộp thoại / bảng âm lượng đang mở
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSoundOpen(false);
      setListOpen(false);
      setNotifyOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sectionLabel = section === "listening" ? "Listening" : "Reading";
  const title = directionsPart
    ? `Listening: Part ${directionsPart} Directions`
    : `${sectionLabel}: Questions ${range(group)} of ${p.total}`;
  const groupFlagged = group.questionNumbers.some((n) => p.flagged.has(n));
  const showBottom = !p.locked || section === "reading";

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#eef1f6] text-[#1d2433] dark:bg-bg dark:text-fg">
      {/* ---------- thanh trên ---------- */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-[#0b2447] px-3 py-2 text-white sm:px-6 sm:py-3">
        <Link
          href={`/tests/${p.testId}`}
          title="Thoát phòng thi (bài làm đã được lưu)"
          onClick={(e) => {
            e.preventDefault();
            setExitOpen(true);
          }}
          aria-label="Thoát phòng thi"
          className="shrink-0"
        >
          <Logo onDark />
        </Link>
        <h1 className="order-last w-full text-center text-base font-semibold sm:order-none sm:w-auto sm:flex-1 sm:text-xl">
          {title}
        </h1>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <div className="relative">
            <button
              onClick={() => setSoundOpen((o) => !o)}
              aria-label="Âm lượng"
              className="grid size-9 place-items-center rounded-md bg-[#3b8fe5] hover:brightness-110"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
              </svg>
            </button>
            {soundOpen && <div className="fixed inset-0 z-[5]" onClick={() => setSoundOpen(false)} aria-hidden />}
            {soundOpen && (
              <div className="absolute top-11 right-0 z-10 w-48 rounded-lg bg-white p-3 text-sm text-[#1d2433] shadow-lg">
                <label className="block">
                  Âm lượng
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={p.volume}
                    onChange={(e) => p.onVolume(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
              </div>
            )}
          </div>
          {p.audioBlocked && section === "listening" && (
            <button onClick={p.onPlayAudio} className="rounded-md bg-warn px-2.5 py-1.5 text-sm font-semibold text-white">
              ▶ Phát audio
            </button>
          )}
          <span className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-[#0b2447] tabular-nums">
            <SmoothWidth>
              {p.answered}/{p.total}
            </SmoothWidth>
          </span>
          <span
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold tabular-nums ${
              p.remaining !== null && p.remaining <= 300 ? "bg-danger" : "bg-[#3b8fe5]"
            }`}
            aria-label="Thời gian còn lại"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {p.remaining !== null ? formatDuration(p.remaining) : "--:--"}
          </span>
          <button
            onClick={() => setNotifyOpen(true)}
            disabled={p.submitting}
            className="rounded-md bg-[#f7941d] px-4 py-1.5 text-sm font-semibold hover:brightness-110 disabled:opacity-60"
          >
            Submit
          </button>
        </div>
      </header>

      {/* ---------- hai khung ---------- */}
      <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6 lg:overflow-hidden">
        {/* key theo nhóm câu: sang câu mới thì hai khung cuộn lại từ đầu */}
        <div key={directionsPart ? `dir-${directionsPart}` : group.id} className="step-fade mx-auto grid max-w-[1600px] grid-cols-1 gap-4 lg:h-full lg:grid-cols-2 lg:gap-6">
          <section className="min-h-0 min-w-0 rounded-md border border-[#d9dee8] bg-white p-4 sm:p-6 lg:overflow-y-auto dark:border-line dark:bg-surface">
            {directionsPart ? (
              <>
                <h2 className="text-lg font-semibold text-[#1b4f8a] dark:text-primary">Part {directionsPart}: Directions</h2>
                <p className="mt-3 leading-relaxed">{DIRECTIONS[directionsPart as 1 | 2 | 3 | 4]}</p>
              </>
            ) : (
              <LeftPanel group={group} />
            )}
          </section>
          <section className="min-h-0 min-w-0 rounded-md border border-[#d9dee8] bg-white p-4 sm:p-6 lg:overflow-y-auto dark:border-line dark:bg-surface">
            <h2 className="text-lg font-semibold text-[#1b4f8a] dark:text-primary">Question</h2>
            {directionsPart ? (
              <p className="mt-3 text-muted">Hãy nghe phần hướng dẫn. Câu hỏi sẽ tự hiện khi audio tới câu đầu tiên của part.</p>
            ) : (
              <div className="mt-2 space-y-5">
                {group.questions.map((q) => {
                  const spoken = q.part <= 2;
                  return (
                    <div key={q.number} id={`q-${q.number}`}>
                      <p className="font-semibold">
                        {q.number}. {spoken ? `Question ${q.number}` : q.question}
                      </p>
                      <div className="mt-2 space-y-2" role="radiogroup" aria-label={`Câu ${q.number}`}>
                        {optionLetters(q.part).map((l) => {
                          const checked = answers[q.number] === l;
                          return (
                            <label
                              key={l}
                              // kéo chuột / bấm đúp để bôi đen chữ trong phương án (để copy) → không đổi lựa chọn
                              onClick={(e) => {
                                if (isTextSelectGesture(e)) e.preventDefault();
                              }}
                              className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
                                checked
                                  ? "border-[#3b8fe5] bg-[#eaf3fd] dark:bg-primary-soft"
                                  : "border-[#e1e5ec] hover:bg-[#f5f7fa] dark:border-line dark:hover:bg-surface-2"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q-${q.number}`}
                                checked={checked}
                                onChange={() => p.onSelect(q.number, l)}
                                className="mt-0.5 size-4 shrink-0 accent-[#1b4f8a]"
                              />
                              <span>
                                ({l}){!spoken && q.options[l] ? ` ${q.options[l]}` : ""}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ---------- thanh dưới (Reading, hoặc khi phần nghe không tự chạy) ---------- */}
      {showBottom && !directionsPart && (
        <footer className="flex items-center justify-between gap-3 border-t border-[#d9dee8] bg-white pl-3 sm:pl-6 dark:border-line dark:bg-surface">
          <label className="flex cursor-pointer items-center gap-2 py-3 text-sm">
            <input
              type="checkbox"
              checked={groupFlagged}
              onChange={(e) => p.onSetFlags(group.questionNumbers, e.target.checked)}
              className="size-5 accent-[#f7941d]"
            />
            Mark item for review
          </label>
          <div className="flex self-stretch">
            <button
              onClick={() => setListOpen(true)}
              aria-label="Danh sách câu hỏi"
              className="grid w-14 place-items-center bg-[#0b2447] text-white hover:brightness-125"
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
                <path d="M4 6h2v2H4zm4 0h12v2H8zM4 11h2v2H4zm4 0h12v2H8zm-4 5h2v2H4zm4 0h12v2H8z" />
              </svg>
            </button>
            <NavButton dir="prev" disabled={!p.canGo(groupIndex - 1)} onClick={() => p.onGo(groupIndex - 1)} />
            <NavButton dir="next" disabled={!p.canGo(groupIndex + 1)} onClick={() => p.onGo(groupIndex + 1)} />
          </div>
        </footer>
      )}

      <ConfirmDialog
        open={exitOpen}
        icon={ExitIcon}
        title="Thoát phòng thi?"
        confirmLabel="Thoát"
        onCancel={() => setExitOpen(false)}
        onConfirm={() => router.push(`/tests/${p.testId}`)}
      >
        Bài làm đã được lưu tự động, bạn có thể vào lại và làm tiếp. Đồng hồ vẫn tính từ chỗ đã dừng.
      </ConfirmDialog>
      {listOpen && (
        <Modal onClose={() => setListOpen(false)} title="QUESTIONS" titleClass="text-[#0b2447] dark:text-fg">
          <QuestionMap
            {...p}
            onPick={(gi, n) => {
              setListOpen(false);
              p.onGo(gi, n);
            }}
          />
        </Modal>
      )}
      {notifyOpen && (
        <Modal onClose={() => setNotifyOpen(false)} title="NOTIFICATION" titleClass="text-danger">
          <p className="text-center text-lg">
            {p.answered < p.total ? "You have unanswered questions. Submit anyway?" : "Submit your test now?"}
          </p>
          {p.answered < p.total && (
            <div className="mt-5">
              <QuestionMap
                {...p}
                unansweredOnly
                onPick={(gi, n) => {
                  setNotifyOpen(false);
                  p.onGo(gi, n);
                }}
              />
            </div>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => setNotifyOpen(false)} className="rounded-md border border-line px-5 py-2 font-semibold">
              Cancel
            </button>
            <button
              onClick={() => {
                setNotifyOpen(false);
                p.onSubmit();
              }}
              className="rounded-md bg-[#f7941d] px-5 py-2 font-semibold text-white"
            >
              Submit
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LeftPanel({ group }: { group: QuestionGroup }) {
  const images = group.images.filter((i) => i.src);
  const passages = group.passages.filter((x) => x.en);
  // Part 6: chỗ trống chỉ hiện số câu (như đề thật), không điền đáp án
  const render = (s: string): ReactNode =>
    group.part === 6 ? renderBlanks(s, { questions: group.questions, answers: {}, isRevealed: () => false, lang: "en" }) : s;
  return (
    <>
      <p className="text-lg font-semibold text-[#1b4f8a] dark:text-primary">{INSTRUCTIONS[group.part]}</p>
      {images.length > 0 && (
        <div className="mt-6 space-y-4">
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.src}
              src={mediaUrl(img.src)!}
              alt={`Hình câu ${group.questionNumbers.join(", ")}`}
              className="mx-auto max-h-[60vh] w-auto rounded border border-[#e1e5ec] bg-white object-contain"
            />
          ))}
        </div>
      )}
      {group.part >= 6 && passages.length > 0 && (
        <div className="mt-5 space-y-4">
          {passages.map((x, i) => (
            <PassageView key={i} en={x.en} vi="" view="en" renderText={render} />
          ))}
        </div>
      )}
    </>
  );
}

function NavButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Câu trước" : "Câu sau"}
      className="grid w-14 place-items-center bg-[#4c9a4f] text-white hover:brightness-110 disabled:bg-[#9cc39d] disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

function Modal({ title, titleClass, onClose, children }: { title: string; titleClass: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 text-[#1d2433] shadow-2xl sm:p-8 dark:bg-surface dark:text-fg"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Đóng" className="absolute top-3 right-3 grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2">
          ✕
        </button>
        <h2 className={`text-center text-2xl font-bold tracking-wide ${titleClass}`}>{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/** Bảng câu theo phần thi (Listening / Reading) và part; câu đánh dấu màu cam */
function QuestionMap({
  groups,
  groupIndex,
  answers,
  flagged,
  canGo,
  unansweredOnly,
  onPick,
}: CbtProps & { unansweredOnly?: boolean; onPick: (gi: number, n: number) => void }) {
  const sections: { name: string; parts: PartNo[] }[] = [
    { name: "Listening", parts: [1, 2, 3, 4] },
    { name: "Reading", parts: [5, 6, 7] },
  ];
  return (
    <div className="space-y-5">
      {sections.map((sec) => {
        const rows = sec.parts
          .map((part) => ({
            part,
            cells: groups.flatMap((g, gi) =>
              g.part === part
                ? g.questionNumbers.filter((n) => !unansweredOnly || !answers[n] || flagged.has(n)).map((n) => ({ n, gi }))
                : [],
            ),
          }))
          .filter((r) => r.cells.length);
        // phần thi đã qua và không quay lại được (Listening khi đang ở Reading) → ẩn như máy thi
        const current = rows.some((r) => r.cells.some((c) => c.gi === groupIndex));
        if (!rows.length || (!current && !rows.some((r) => r.cells.some((c) => canGo(c.gi))))) return null;
        return (
          <div key={sec.name}>
            <div className="rounded-md bg-[#0b4f8a] px-4 py-2.5 text-lg font-semibold text-white">{sec.name}</div>
            <div className="mt-3 space-y-4 border-l-2 border-[#d9dee8] pl-4 dark:border-line">
              {rows.map(({ part, cells }) => (
                <div key={part}>
                  <div className="mb-2 text-lg font-semibold text-[#1b4f8a] dark:text-primary">Part {part}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {cells.map(({ n, gi }) => {
                      const enabled = canGo(gi);
                      const cls = flagged.has(n)
                        ? "bg-[#f7941d] text-white"
                        : answers[n]
                          ? "bg-[#0b2447] text-white"
                          : "bg-[#e6e9ef] text-[#5d6475] dark:bg-surface-2 dark:text-muted";
                      return (
                        <button
                          key={n}
                          disabled={!enabled}
                          onClick={() => onPick(gi, n)}
                          className={`h-9 w-11 rounded text-sm font-semibold ${cls} ${gi === groupIndex ? "ring-2 ring-[#3b8fe5] ring-offset-1" : ""} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted">
        <span className="mr-1 inline-block size-3 rounded-sm bg-[#0b2447] align-middle" /> đã làm ·{" "}
        <span className="mr-1 inline-block size-3 rounded-sm bg-[#e6e9ef] align-middle" /> chưa làm ·{" "}
        <span className="mr-1 inline-block size-3 rounded-sm bg-[#f7941d] align-middle" /> đánh dấu xem lại
      </p>
    </div>
  );
}
