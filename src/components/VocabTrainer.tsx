"use client";

import { useEffect, useMemo, useState } from "react";
import { VOCAB_INTERVALS, resetVocab, reviewVocab, useVocabCards, type VocabCard } from "@/lib/storage";
import type { VocabEntry } from "@/lib/types";

const POS_LABEL: Record<string, string> = {
  n: "danh từ",
  v: "động từ",
  adj: "tính từ",
  adv: "trạng từ",
  prep: "giới từ",
  conj: "liên từ",
  pron: "đại từ",
};
const MASTER_BOX = VOCAB_INTERVALS.length + 1;
const NEW_OPTIONS = [5, 10, 20, 30];

type Status = "new" | "learning" | "mastered";
function statusOf(c: VocabCard | undefined): Status {
  if (!c) return "new";
  return c.box >= MASTER_BOX ? "mastered" : "learning";
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

export default function VocabTrainer({ vocab }: { vocab: VocabEntry[] }) {
  const cards = useVocabCards();
  const [tab, setTab] = useState<"learn" | "list">("learn");
  const [newPerSession, setNewPerSession] = useState(10);
  const [session, setSession] = useState<VocabEntry[] | null>(null);
  const [now] = useState(() => Date.now());

  const due = useMemo(
    () =>
      vocab
        .filter((v) => cards[v.w] && cards[v.w].box < MASTER_BOX && cards[v.w].due <= now)
        .sort((a, b) => cards[a.w].due - cards[b.w].due),
    [vocab, cards, now],
  );
  const fresh = useMemo(() => vocab.filter((v) => !cards[v.w]), [vocab, cards]);
  const learning = vocab.filter((v) => statusOf(cards[v.w]) === "learning").length;
  const mastered = vocab.filter((v) => statusOf(cards[v.w]) === "mastered").length;

  if (session) return <FlashcardSession cards={session} onExit={() => setSession(null)} />;

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile value={due.length} label="Đến hạn ôn" tone="text-warn" />
        <Tile value={learning} label="Đang học" tone="text-primary" />
        <Tile value={mastered} label="Đã thuộc" tone="text-success" />
        <Tile value={fresh.length} label="Chưa học" />
      </div>

      <div className="mt-6 flex gap-2">
        {(
          [
            ["learn", "Học thẻ"],
            ["list", "Danh sách từ"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t ? "bg-fg text-bg" : "bg-surface text-muted hover:text-fg"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "learn" ? (
        <div className="mt-5 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Phiên học hôm nay</h2>
          <p className="mt-1 text-sm text-muted">
            Ôn {due.length} thẻ đến hạn trước, sau đó học từ mới theo thứ tự xuất hiện nhiều nhất trong đề. Nhớ → thẻ lên hộp
            tiếp theo, ôn lại sau {VOCAB_INTERVALS.join(" → ")} ngày; quên → về hộp 1.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Số từ mới:</span>
            {NEW_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setNewPerSession(n)}
                className={`rounded-full border px-3 py-1 ${newPerSession === n ? "border-primary bg-primary-soft text-primary" : "border-line"}`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            disabled={!due.length && !fresh.length}
            onClick={() => setSession([...due, ...fresh.slice(0, newPerSession)])}
            className="mt-5 rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary hover:opacity-90 disabled:opacity-40"
          >
            Bắt đầu ({due.length} ôn + {Math.min(newPerSession, fresh.length)} mới)
          </button>
        </div>
      ) : (
        <WordList vocab={vocab} cards={cards} />
      )}
    </>
  );
}

function Tile({ value, label, tone = "" }: { value: number; label: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className={`text-3xl font-bold tabular-nums ${tone}`}>{value.toLocaleString("vi-VN")}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

function Highlight({ text, word }: { text: string; word: string }) {
  const re = new RegExp(`(\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b)`, "i");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <b key={i} className="text-primary">
            {p}
          </b>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function PosChips({ pos }: { pos: string[] }) {
  return (
    <>
      {pos.map((p) => (
        <span key={p} className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
          {POS_LABEL[p] ?? p}
        </span>
      ))}
    </>
  );
}

function FlashcardSession({ cards: initial, onExit }: { cards: VocabEntry[]; onExit: () => void }) {
  const [queue, setQueue] = useState(initial);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ remembered: 0, forgot: 0 });
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const card = queue[0];

  const answer = (remembered: boolean) => {
    if (!card) return;
    reviewVocab(card.w, remembered);
    setStats((s) => ({ remembered: s.remembered + (remembered ? 1 : 0), forgot: s.forgot + (remembered ? 0 : 1) }));
    setFlipped(false);
    // quên → đưa thẻ về cuối hàng để gặp lại một lần trong phiên
    if (!remembered && !requeued.has(card.w)) {
      setRequeued((r) => new Set(r).add(card.w));
      setQueue((q) => [...q.slice(1), card]);
    } else setQueue((q) => q.slice(1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === "1") answer(false);
      else if (flipped && e.key === "2") answer(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    return (
      <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="text-sm text-muted">Hoàn thành phiên học</div>
        <div className="mt-2 text-4xl font-bold">{initial.length} thẻ</div>
        <div className="mt-1 text-muted">
          Nhớ {stats.remembered} lượt · quên {stats.forgot} lượt
        </div>
        <button onClick={onExit} className="mt-6 rounded-lg bg-primary px-5 py-2 font-semibold text-on-primary">
          Xong
        </button>
      </div>
    );
  }

  const done = initial.length - queue.length;
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-3 text-sm text-muted">
        <button onClick={onExit} className="hover:text-fg">
          ← Thoát
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-primary" style={{ width: `${(done / initial.length) * 100}%` }} />
        </div>
        <span>Còn {queue.length} thẻ</span>
      </div>

      {/* thẻ là div (không phải button) để nút nghe phát âm bên trong hợp lệ; phím Space lật thẻ */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        className="block w-full cursor-pointer rounded-2xl border border-line bg-surface p-8 text-center transition hover:border-primary"
        aria-label={flipped ? "Úp thẻ" : "Lật thẻ"}
      >
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-bold">{card.w}</span>
          <button
            aria-label="Nghe phát âm"
            onClick={(e) => {
              e.stopPropagation();
              speak(card.w);
            }}
            className="rounded-full bg-surface-2 px-2.5 py-1.5 text-lg hover:bg-primary-soft"
          >
            🔊
          </button>
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          <PosChips pos={card.pos} />
          <span className="text-xs text-muted">· gặp {card.freq} lần trong đề</span>
        </div>
        {flipped ? (
          <div className="mt-6 space-y-3 text-left">
            <div className="text-center text-xl font-semibold text-primary">{card.meanings.join("; ")}</div>
            {card.examples.map((ex) => (
              <div key={`${ex.testId}:${ex.number}`} className="rounded-lg bg-surface-2 p-3 text-sm">
                <Highlight text={ex.text} word={card.w} />
                <div className="mt-1 text-xs text-muted">
                  {ex.testId.replace("-test", " · Test ")} · câu {ex.number}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 text-sm text-muted">Nhớ nghĩa của từ này không? Bấm thẻ hoặc phím Space để lật.</div>
        )}
      </div>

      {flipped && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => answer(false)} className="rounded-xl border border-danger bg-danger-soft py-3 font-semibold text-danger">
            Chưa nhớ <span className="text-xs opacity-70">(1)</span>
          </button>
          <button onClick={() => answer(true)} className="rounded-xl border border-success bg-success-soft py-3 font-semibold text-success">
            Nhớ rồi <span className="text-xs opacity-70">(2)</span>
          </button>
        </div>
      )}
    </div>
  );
}

const PAGE = 60;

function WordList({ vocab, cards }: { vocab: VocabEntry[]; cards: Record<string, VocabCard> }) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [limit, setLimit] = useState(PAGE);

  const query = q.trim().toLowerCase();
  const list = vocab.filter(
    (v) =>
      (pos === "all" || v.pos.includes(pos)) &&
      (status === "all" || statusOf(cards[v.w]) === status) &&
      (!query || v.w.includes(query) || v.meanings.some((m) => m.toLowerCase().includes(query))),
  );

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | "all")}
          className="rounded-lg border border-line bg-surface px-2 py-2 text-sm"
          aria-label="Lọc theo trạng thái"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="new">Chưa học</option>
          <option value="learning">Đang học</option>
          <option value="mastered">Đã thuộc</option>
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["all", ...Object.keys(POS_LABEL)] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPos(p)}
            className={`rounded-full border px-3 py-1 text-sm ${pos === p ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface"}`}
          >
            {p === "all" ? "Tất cả" : POS_LABEL[p]}
          </button>
        ))}
      </div>
      <div className="mt-2 text-sm text-muted">{list.length.toLocaleString("vi-VN")} từ</div>

      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
        {list.slice(0, limit).map((v) => {
          const st = statusOf(cards[v.w]);
          return (
            <div key={v.w} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 last:border-0">
              <button onClick={() => speak(v.w)} aria-label={`Nghe phát âm ${v.w}`} className="text-sm opacity-70 hover:opacity-100">
                🔊
              </button>
              <span className="w-40 font-semibold">{v.w}</span>
              <span className="flex gap-1">
                <PosChips pos={v.pos} />
              </span>
              <span className="min-w-0 flex-1 text-sm">{v.meanings.join("; ")}</span>
              <span className="text-xs text-muted">{v.freq}×</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  st === "mastered" ? "bg-success-soft text-success" : st === "learning" ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted"
                }`}
              >
                {st === "mastered" ? "Đã thuộc" : st === "learning" ? `Hộp ${cards[v.w].box}` : "Mới"}
              </span>
              {st !== "new" && (
                <button onClick={() => resetVocab(v.w)} className="text-xs text-muted hover:text-danger" title="Học lại từ đầu">
                  ↺
                </button>
              )}
            </div>
          );
        })}
        {!list.length && <div className="p-8 text-center text-muted">Không có từ nào khớp.</div>}
      </div>
      {list.length > limit && (
        <button onClick={() => setLimit((l) => l + PAGE)} className="mt-3 w-full rounded-lg border border-line py-2 text-sm hover:bg-surface-2">
          Xem thêm ({list.length - limit} từ)
        </button>
      )}
    </div>
  );
}
