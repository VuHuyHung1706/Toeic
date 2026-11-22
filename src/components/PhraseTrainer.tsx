"use client";
// Mục "Cụm giới từ" trong trang Từ vựng: lọc theo nhóm (danh từ / động từ / tính từ + giới từ, giới từ + danh từ),
// học bằng thẻ ghi nhớ (dùng chung lịch ôn ngắt quãng với từ vựng) hoặc xem danh sách có tìm kiếm.
// Dữ liệu: content/phrases.json (nhập bằng scripts/import_phrases.py).

import { useEffect, useMemo, useRef, useState } from "react";
import FlashcardDeck, { type DeckCard } from "./FlashcardDeck";
import ListCount from "./ListCount";
import Pagination from "./Pagination";
import SearchBox from "./SearchBox";
import SegmentedTabs from "./SegmentedTabs";
import { CardsSkeleton } from "./Skeleton";
import SmoothWidth from "./SmoothWidth";
import TermRow from "./TermRow";
import { findPhrase, phraseCardKey } from "@/lib/phrases";
import { useStars } from "@/lib/stars";
import { VOCAB_INTERVALS, resetVocab, useVocabCards, type VocabCard } from "@/lib/storage";
import type { Phrase, PhraseGroup } from "@/lib/types";

const MASTER_BOX = VOCAB_INTERVALS.length + 1;
const NEW_OPTIONS = [5, 10, 20, 30];
type Item = Phrase & { group: string; groupLabel: string; key: string };
type Status = "new" | "learning" | "mastered";
const statusOf = (c: VocabCard | undefined): Status => (!c ? "new" : c.box >= MASTER_BOX ? "mastered" : "learning");

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

export default function PhraseTrainer({ active = true }: { active?: boolean }) {
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
  return <Trainer groups={groups} active={active} />;
}

function Trainer({ groups, active }: { groups: PhraseGroup[]; active: boolean }) {
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

  if (session) return <Session cards={session} active={active} onExit={() => setSession(null)} />;

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
        <PhraseList items={items} cards={cards} showGroup={group === "all"} />
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

const PAGE = 30;

const STATUS_TABS: { key: Status | "all" | "starred"; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "new", label: "Mới" },
  { key: "learning", label: "Đang học" },
  { key: "mastered", label: "Đã thuộc" },
  { key: "starred", label: "★ Gắn sao" },
];

function PhraseList({ items, cards, showGroup }: { items: Item[]; cards: Record<string, VocabCard>; showGroup: boolean }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "all" | "starred">("all");
  const [page, setPage] = useState(1);
  const stars = useStars();
  const topRef = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (it) =>
        (status === "all" || (status === "starred" ? stars.has(it.key) : statusOf(cards[it.key]) === status)) &&
        (!s || it.phrase.toLowerCase().includes(s) || it.meaning.toLowerCase().includes(s)),
    );
  }, [items, q, status, stars, cards]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const cur = Math.min(page, pages);
  const pageList = shown.slice((cur - 1) * PAGE, cur * PAGE);

  return (
    <div ref={topRef} className="mt-5 scroll-mt-20">
      <SearchBox
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        placeholder="Tìm cụm tiếng Anh hoặc nghĩa tiếng Việt…"
      />
      <div className="mt-3">
        <SegmentedTabs
          label="Lọc theo trạng thái"
          size="sm"
          items={STATUS_TABS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>
      <ListCount from={(cur - 1) * PAGE} shown={pageList.length} total={shown.length} unit="cụm" />
      <ul className="grid gap-2">
        {pageList.map((it) => (
          <TermRow
            key={it.key}
            id={it.key}
            term={it.phrase}
            speak={it.phrase}
            meaning={it.meaning}
            card={cards[it.key]}
            starred={stars.has(it.key)}
            onReset={() => resetVocab(it.key)}
            tags={showGroup ? <span className="rounded-md bg-surface-2 px-1.5 py-0.5">{it.groupLabel}</span> : undefined}
            below={
              it.example && (
                <div className="text-sm leading-6 text-muted">
                  <Example item={it} />
                </div>
              )
            }
          />
        ))}
      </ul>
      {!shown.length && <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">Không có cụm nào khớp.</div>}
      <Pagination
        page={cur}
        total={pages}
        onChange={(p) => {
          setPage(p);
          topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
    </div>
  );
}

/** Gợi ý mặt trước: câu ví dụ với cụm bị che */
function BlankedExample({ item }: { item: Item }) {
  const hit = item.example ? findPhrase(item.example, item.phrase) : null;
  if (!hit) return null;
  return (
    <span>
      {hit[0]}
      <span className="mx-0.5 inline-block w-20 border-b-2 border-primary align-baseline" aria-label="cụm bị che" />
      {hit[2]}
    </span>
  );
}

function Session({ cards, active, onExit }: { cards: Item[]; active: boolean; onExit: () => void }) {
  const deck: DeckCard[] = useMemo(
    () =>
      cards.map((c) => ({
        id: c.key,
        term: c.phrase,
        tag: c.groupLabel,
        meaning: c.meaning,
        speak: c.phrase,
        hint: c.example && findPhrase(c.example, c.phrase) ? <BlankedExample item={c} /> : undefined,
        details: c.example ? (
          <div className="rounded-xl border border-line p-3">
            <Example item={c} />
          </div>
        ) : undefined,
      })),
    [cards],
  );
  return <FlashcardDeck cards={deck} active={active} onExit={onExit} />;
}
