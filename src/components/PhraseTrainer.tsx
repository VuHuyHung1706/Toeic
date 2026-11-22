"use client";
// Mục "Cụm giới từ" trong trang Từ vựng: lọc theo nhóm (danh từ / động từ / tính từ + giới từ, giới từ + danh từ),
// học bằng thẻ ghi nhớ (dùng chung lịch ôn ngắt quãng với từ vựng) hoặc xem danh sách có tìm kiếm.
// Dữ liệu: content/phrases.json (nhập bằng scripts/import_phrases.py).

import { useEffect, useMemo, useState } from "react";
import SegmentedTabs from "./SegmentedTabs";
import { CardsSkeleton } from "./Skeleton";
import SmoothWidth from "./SmoothWidth";
import { findPhrase, phraseCardKey } from "@/lib/phrases";
import { VOCAB_INTERVALS, reviewVocab, useVocabCards, type VocabCard } from "@/lib/storage";
import type { Phrase, PhraseGroup } from "@/lib/types";

const MASTER_BOX = VOCAB_INTERVALS.length + 1;
const NEW_OPTIONS = [5, 10, 20, 30];
type Item = Phrase & { group: string; groupLabel: string; key: string };
type Status = "new" | "learning" | "mastered";
const statusOf = (c: VocabCard | undefined): Status => (!c ? "new" : c.box >= MASTER_BOX ? "mastered" : "learning");

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/\b(A|B)\b/g, "").replace(/\s*\/\s*/g, ", "));
    u.lang = "en-US";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* trình duyệt không hỗ trợ đọc */
  }
}

/** Câu ví dụ, cụm được tô sáng */
function Example({ item }: { item: Item }) {
  if (!item.example) return null;
  const hit = findPhrase(item.example, item.phrase);
  return (
    <span>
      {hit ? (
        <>
          {hit[0]}
          <mark className="rounded bg-primary-soft px-0.5 font-semibold text-primary">{hit[1]}</mark>
          {hit[2]}
        </>
      ) : (
        item.example
      )}
    </span>
  );
}

export default function PhraseTrainer() {
  const [groups, setGroups] = useState<PhraseGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/phrases")
      .then((r) => (r.ok ? (r.json() as Promise<PhraseGroup[]>) : Promise.reject(new Error("Không tải được cụm giới từ"))))
      .then(
        (g) => alive && setGroups(g),
        (e: Error) => alive && setError(e.message),
      );
    return () => {
      alive = false;
    };
  }, []);
  if (error) return <p className="mt-8 text-danger">{error}</p>;
  if (!groups) return <CardsSkeleton label="Đang tải cụm giới từ" cards={6} />;
  if (!groups.length) return <p className="mt-8 text-muted">Chưa có dữ liệu cụm giới từ.</p>;
  return <Trainer groups={groups} />;
}

function Trainer({ groups }: { groups: PhraseGroup[] }) {
  const cards = useVocabCards();
  const [group, setGroup] = useState<string>("all");
  const [tab, setTab] = useState<"learn" | "list">("learn");
  const [newPerSession, setNewPerSession] = useState(10);
  const [allNew, setAllNew] = useState(false);
  const [session, setSession] = useState<Item[] | null>(null);
  const [now] = useState(() => Date.now());

  const all = useMemo<Item[]>(
    () => groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.key, groupLabel: g.label, key: phraseCardKey(g.key, it.phrase) }))),
    [groups],
  );
  const items = useMemo(() => (group === "all" ? all : all.filter((it) => it.group === group)), [all, group]);
  const due = useMemo(
    () => items.filter((it) => cards[it.key] && cards[it.key].box < MASTER_BOX && cards[it.key].due <= now).sort((a, b) => cards[a.key].due - cards[b.key].due),
    [items, cards, now],
  );
  const fresh = useMemo(() => items.filter((it) => !cards[it.key]), [items, cards]);
  const learning = items.filter((it) => statusOf(cards[it.key]) === "learning").length;
  const mastered = items.filter((it) => statusOf(cards[it.key]) === "mastered").length;
  const newCount = allNew ? fresh.length : Math.min(newPerSession, fresh.length);

  if (session) return <Session cards={session} onExit={() => setSession(null)} />;

  return (
    <>
      <div className="mt-6">
        <SegmentedTabs
          label="Nhóm cụm giới từ"
          items={[
            { key: "all", label: "Tất cả", count: all.length },
            ...groups.map((g) => ({ key: g.key, label: g.label, count: g.items.length })),
          ]}
          value={group}
          onChange={setGroup}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile value={due.length} label="Đến hạn ôn" tone="text-warn" />
        <Tile value={learning} label="Đang học" tone="text-primary" />
        <Tile value={mastered} label="Đã thuộc" tone="text-success" />
        <Tile value={fresh.length} label="Chưa học" />
      </div>

      <div className="mt-6">
        <SegmentedTabs
          label="Chế độ"
          items={[
            { key: "learn" as const, label: "Học thẻ" },
            { key: "list" as const, label: "Danh sách cụm" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "learn" ? (
        <div className="mt-5 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Học cụm giới từ</h2>
          <p className="mt-1 text-sm text-muted">
            Ôn {due.length} thẻ đến hạn trước, sau đó học cụm mới. Mặt trước là cụm, mặt sau là nghĩa và câu ví dụ. Nhớ → thẻ lên hộp tiếp
            theo, ôn lại sau {VOCAB_INTERVALS.join(" → ")} ngày; quên → về hộp 1.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Số cụm mới:</span>
            <SegmentedTabs
              label="Số cụm mới"
              size="sm"
              items={[...NEW_OPTIONS.map((n) => ({ key: `${n}`, label: `${n}` })), { key: "all", label: "Tất cả", count: fresh.length }]}
              value={allNew ? "all" : `${newPerSession}`}
              onChange={(k) => {
                setAllNew(k === "all");
                if (k !== "all") setNewPerSession(Number(k));
              }}
            />
          </div>
          <button
            disabled={!due.length && !fresh.length}
            onClick={() => setSession([...due, ...fresh.slice(0, newCount)])}
            className="mt-5 rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary hover:opacity-90 disabled:opacity-40"
          >
            <SmoothWidth>
              Bắt đầu ({due.length} ôn + {newCount} mới)
            </SmoothWidth>
          </button>
          {!due.length && !fresh.length && <p className="mt-3 text-sm text-success">Bạn đã học hết các cụm của nhóm này 🎉</p>}
        </div>
      ) : (
        <PhraseList items={items} cards={cards} />
      )}
    </>
  );
}

function Tile({ value, label, tone = "" }: { value: number; label: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>{value.toLocaleString("vi-VN")}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

const STATUS_BADGE: Record<Status, [string, string]> = {
  new: ["Mới", "bg-surface-2 text-muted"],
  learning: ["Đang học", "bg-primary-soft text-primary"],
  mastered: ["Đã thuộc", "bg-success-soft text-success"],
};

function PhraseList({ items, cards }: { items: Item[]; cards: Record<string, VocabCard> }) {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(60);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((it) => it.phrase.toLowerCase().includes(s) || it.meaning.toLowerCase().includes(s)) : items;
  }, [items, q]);

  return (
    <div className="mt-5">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setLimit(60);
        }}
        placeholder="Tìm cụm tiếng Anh hoặc nghĩa tiếng Việt…"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2"
      />
      <div className="mt-2 text-sm text-muted">{shown.length.toLocaleString("vi-VN")} cụm</div>
      <div className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {shown.slice(0, limit).map((it) => {
          const [label, cls] = STATUS_BADGE[statusOf(cards[it.key])];
          return (
            <div key={it.key} className="p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <button onClick={() => speak(it.phrase)} aria-label={`Nghe: ${it.phrase}`} className="text-sm opacity-70 hover:opacity-100">
                  🔊
                </button>
                <span className="font-semibold">{it.phrase}</span>
                <span className="text-sm text-vi">{it.meaning}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
              </div>
              {it.example && (
                <div className="mt-1.5 text-sm leading-6 text-muted">
                  <Example item={it} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {shown.length > limit && (
        <button onClick={() => setLimit((l) => l + 60)} className="mt-3 w-full rounded-lg border border-line py-2 text-sm hover:bg-surface-2">
          Xem thêm {Math.min(60, shown.length - limit)} cụm
        </button>
      )}
    </div>
  );
}

function Session({ cards: initial, onExit }: { cards: Item[]; onExit: () => void }) {
  const [queue, setQueue] = useState(initial);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ remembered: 0, forgot: 0 });
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const card = queue[0];

  const answer = (remembered: boolean) => {
    if (!card) return;
    reviewVocab(card.key, remembered);
    setStats((s) => ({ remembered: s.remembered + (remembered ? 1 : 0), forgot: s.forgot + (remembered ? 0 : 1) }));
    setFlipped(false);
    // quên → đưa thẻ về cuối hàng để gặp lại một lần trong phiên
    if (!remembered && !requeued.has(card.key)) {
      setRequeued((r) => new Set(r).add(card.key));
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
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${(done / initial.length) * 100}%` }} />
        </div>
        <span>Còn {queue.length} thẻ</span>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        className="block w-full cursor-pointer rounded-2xl border border-line bg-surface p-8 text-center transition hover:border-primary"
        aria-label={flipped ? "Úp thẻ" : "Lật thẻ"}
      >
        <div className="text-xs font-semibold tracking-wide text-muted uppercase">{card.groupLabel}</div>
        <div className="mt-2 flex items-center justify-center gap-3">
          <span className="text-3xl font-bold sm:text-4xl">{card.phrase}</span>
          <button
            aria-label="Nghe phát âm"
            onClick={(e) => {
              e.stopPropagation();
              speak(card.phrase);
            }}
            className="rounded-full bg-surface-2 px-2.5 py-1.5 text-lg hover:bg-primary-soft"
          >
            🔊
          </button>
        </div>
        {flipped ? (
          <div className="step-fade mt-6 space-y-3 text-left">
            <div className="text-center text-xl font-semibold text-primary">{card.meaning}</div>
            {card.example && (
              <div className="rounded-lg border border-line p-3 text-sm leading-6">
                <Example item={card} />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 text-sm text-muted">Nhớ nghĩa của cụm này không? Bấm thẻ hoặc phím Space để lật.</div>
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
