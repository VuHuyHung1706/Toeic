"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { VOCAB_INTERVALS, resetVocab, setPref, usePref, useVocabCards, type VocabCard } from "@/lib/storage";
import { useStars } from "@/lib/stars";
import type { VocabEntry } from "@/lib/types";
import FlashcardDeck, { type DeckCard } from "./FlashcardDeck";
import ListCount from "./ListCount";
import Pagination from "./Pagination";
import SearchBox from "./SearchBox";
import SegmentedTabs from "./SegmentedTabs";
import { CardsSkeleton } from "./Skeleton";
import SmoothWidth from "./SmoothWidth";
import TermRow from "./TermRow";

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
type Source = "all" | "r" | "l";
type TestRef = { id: string; year: number; number: number };
type Tab = "learn" | "list";

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

/** Phạm vi bộ từ: "all" (mọi đề), "y:2026" (mọi đề của một năm) hoặc id một đề */
const yearOfScope = (scope: string) => (scope.startsWith("y:") ? Number(scope.slice(2)) : null);
const isSingleTest = (scope: string) => scope !== "all" && !scope.startsWith("y:");

/** Từ có thuộc phạm vi / nguồn đang chọn không */
function inScope(v: VocabEntry, scope: string, source: Source) {
  const year = yearOfScope(scope);
  const sets =
    scope === "all"
      ? Object.values(v.tests)
      : year !== null
        ? Object.entries(v.tests)
            .filter(([id]) => id.startsWith(`${year}-`))
            .map(([, s]) => s)
        : v.tests[scope]
          ? [v.tests[scope]]
          : [];
  return sets.some((s) => (source === "all" ? s.r || s.l : s[source]));
}

/** Số câu đầu tiên của từ trong đề (để xếp theo thứ tự câu hỏi) */
function firstNumber(v: VocabEntry, testId: string, source: Source) {
  const s = v.tests[testId];
  const nums = source === "all" ? [...(s?.l ?? []), ...(s?.r ?? [])] : (s?.[source] ?? []);
  return nums.length ? Math.min(...nums) : 999;
}

export default function VocabTrainer({ tests, active = true }: { tests: TestRef[]; active?: boolean }) {
  const [allVocab, setAllVocab] = useState<VocabEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/vocab")
      .then((r) => (r.ok ? (r.json() as Promise<VocabEntry[]>) : Promise.reject(new Error("Không tải được từ vựng"))))
      .then(
        (v) => alive && setAllVocab(v),
        (e: Error) => alive && setError(e.message),
      );
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p className="mt-8 text-danger">{error}</p>;
  if (!allVocab) return <CardsSkeleton label="Đang tải từ vựng" cards={6} />;
  return <Trainer allVocab={allVocab} tests={tests} active={active} />;
}

function Trainer({ allVocab, tests, active }: { allVocab: VocabEntry[]; tests: TestRef[]; active: boolean }) {
  const cards = useVocabCards();
  const router = useRouter();
  const params = useSearchParams();
  const initialTest = params.get("test");
  const initialYear = Number(params.get("year"));
  const [testId, setTestIdState] = useState<string>(
    initialTest && tests.some((t) => t.id === initialTest)
      ? initialTest
      : tests.some((t) => t.year === initialYear)
        ? `y:${initialYear}`
        : "all",
  );
  const [tab, setTab] = useState<Tab>("learn");
  const source = usePref<Source>("vocabSource", "all");
  const showBasic = usePref<"0" | "1">("vocabBasic", "0") === "1";
  const [newPerSession, setNewPerSession] = useState(10);
  // "Tất cả": học mọi từ mới của bộ đang chọn (số lượng đổi theo bộ lọc)
  const [allNew, setAllNew] = useState(false);
  const [session, setSession] = useState<VocabEntry[] | null>(null);
  const [now] = useState(() => Date.now());

  const setTestId = (id: string) => {
    setTestIdState(id);
    const year = yearOfScope(id);
    router.replace(id === "all" ? "/vocabulary" : year !== null ? `/vocabulary?year=${year}` : `/vocabulary?test=${id}`, {
      scroll: false,
    });
  };

  const pool = useMemo(() => allVocab.filter((v) => showBasic || !v.basic), [allVocab, showBasic]);
  // từ của đề đang chọn, theo thứ tự câu hỏi trong đề; "tất cả" thì theo số đề có từ đó
  const vocab = useMemo(() => {
    const list = pool.filter((v) => inScope(v, testId, source));
    if (!isSingleTest(testId)) return list;
    return list.sort((a, b) => firstNumber(a, testId, source) - firstNumber(b, testId, source) || a.w.localeCompare(b.w));
  }, [pool, testId, source]);

  const due = useMemo(
    () =>
      vocab
        .filter((v) => cards[v.w] && cards[v.w].box < MASTER_BOX && cards[v.w].due <= now)
        .sort((a, b) => cards[a.w].due - cards[b.w].due),
    [vocab, cards, now],
  );
  const fresh = useMemo(() => vocab.filter((v) => !cards[v.w]), [vocab, cards]);
  const newCount = allNew ? fresh.length : Math.min(newPerSession, fresh.length);
  const learning = vocab.filter((v) => statusOf(cards[v.w]) === "learning").length;
  const mastered = vocab.filter((v) => statusOf(cards[v.w]) === "mastered").length;
  const years = [...new Set(tests.map((t) => t.year))].sort((a, b) => b - a);
  const testLabel = (id: string) => {
    if (id === "all") return `Tất cả ${tests.length} đề`;
    const year = yearOfScope(id);
    if (year !== null) return `ETS ${year} (${tests.filter((t) => t.year === year).length} đề)`;
    const t = tests.find((x) => x.id === id);
    return t ? `ETS ${t.year} · Test ${t.number}` : id;
  };
  const countFor = (scope: string) => pool.filter((v) => inScope(v, scope, source)).length;
  // năm đang mở trong bộ lọc: năm đã chọn, hoặc năm của đề đã chọn
  const openYear = yearOfScope(testId) ?? tests.find((t) => t.id === testId)?.year ?? null;

  if (session) return <FlashcardSession cards={session} testId={testId} active={active} onExit={() => setSession(null)} />;

  return (
    <>
      {/* lọc theo đề (giống Kho đề): chọn năm → chọn đề hoặc cả năm; số là số từ của bộ đó */}
      <div className="mt-6 space-y-2">
        <SegmentedTabs
          label="Lọc từ vựng theo năm"
          items={[
            { key: "all" as const, label: "Tất cả", count: countFor("all") },
            ...years.map((y) => ({ key: y, label: `ETS ${y}`, count: countFor(`y:${y}`) })),
          ]}
          value={openYear ?? "all"}
          onChange={(k) => setTestId(k === "all" ? "all" : `y:${k}`)}
        />
        {openYear !== null && (
          <SegmentedTabs
            label="Lọc từ vựng theo đề"
            items={[
              { key: `y:${openYear}`, label: "Cả năm" },
              ...tests.filter((t) => t.year === openYear).map((t) => ({ key: t.id, label: `Test ${t.number}`, count: countFor(t.id) })),
            ]}
            value={testId}
            onChange={setTestId}
          />
        )}
      </div>

      <div className="mt-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="font-semibold">
            {testLabel(testId)}
            <span className="font-normal text-muted"> · {vocab.length.toLocaleString("vi-VN")} từ</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-muted">Phần:</span>
            <SegmentedTabs
              label="Phần"
              items={[
                { key: "all" as const, label: "Tất cả" },
                { key: "l" as const, label: "🎧 Nghe" },
                { key: "r" as const, label: "📖 Đọc" },
              ]}
              value={source}
              onChange={(k) => setPref("vocabSource", k)}
            />
          </div>
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" checked={showBasic} onChange={(e) => setPref("vocabBasic", e.target.checked ? "1" : "0")} className="size-4" />
            Hiện cả từ cơ bản
          </label>
        </div>
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
            { key: "list" as const, label: "Danh sách từ" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "learn" && (
        <div className="mt-5 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">{testId === "all" ? "Phiên học hôm nay" : `Từ vựng ${testLabel(testId)}`}</h2>
          <p className="mt-1 text-sm text-muted">
            Ôn {due.length} thẻ đến hạn trước, sau đó học từ mới{" "}
            {isSingleTest(testId) ? "theo thứ tự xuất hiện trong đề" : "theo số đề có từ đó (từ hay gặp trước)"}. Mỗi thẻ là một từ gốc
            kèm các dạng khác (danh từ, động từ, tính từ…). Nhớ → thẻ lên hộp tiếp theo, ôn lại sau {VOCAB_INTERVALS.join(" → ")} ngày; quên → về hộp 1.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Số từ mới:</span>
            <SegmentedTabs
              label="Số từ mới"
              size="sm"
              items={[
                ...NEW_OPTIONS.map((n) => ({ key: `${n}`, label: `${n}` })),
                { key: "all", label: "Tất cả", count: fresh.length },
              ]}
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
              Bắt đầu ({due.length.toLocaleString("vi-VN")} ôn + {newCount.toLocaleString("vi-VN")} mới)
            </SmoothWidth>
          </button>
          {!due.length && !fresh.length && <p className="mt-3 text-sm text-success">Bạn đã học hết từ của bộ này 🎉</p>}
        </div>
      )}

      {tab === "list" && <WordList vocab={vocab} cards={cards} testId={isSingleTest(testId) ? testId : null} />}
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

function Highlight({ text, words }: { text: string; words: string[] }) {
  const alts = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const parts = text.split(new RegExp(`\\b(${alts.join("|")})\\b`, "i"));
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

/** Loại từ viết tắt: (n, v, adj…) — rê chuột để xem tên đầy đủ */
function PosChips({ pos }: { pos: string[] }) {
  if (!pos.length) return null;
  return (
    <span className="text-xs font-semibold text-muted" title={pos.map((p) => POS_LABEL[p] ?? p).join(", ")}>
      ({pos.join(", ")})
    </span>
  );
}

/** Các dạng khác của từ (danh từ / động từ / tính từ / trạng từ…) kèm nghĩa */
function OtherForms({ v }: { v: VocabEntry }) {
  if (!v.related.length) return null;
  return (
    <div className="rounded-lg bg-surface-2 p-3 text-left text-sm">
      <div className="mb-1.5 text-xs font-semibold uppercase text-muted">Dạng khác của từ</div>
      <ul className="space-y-1.5">
        {v.related.map((f) => (
          <li key={f.w} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                speak(f.w);
              }}
              className="font-semibold hover:text-primary"
              title="Nghe phát âm"
            >
              {f.w}
            </button>
            <PosChips pos={f.pos} />
            <span className="text-muted">{f.meanings.join("; ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Gợi ý mặt trước: câu ví dụ với từ đang học bị che */
function Blanked({ text, words }: { text: string; words: string[] }) {
  const alts = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const parts = text.split(new RegExp(`\\b(?:${alts.join("|")})\\b`, "i"));
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-0.5 inline-block w-14 border-b-2 border-primary align-baseline" aria-label="từ bị che" />}
          {p}
        </span>
      ))}
    </>
  );
}

function FlashcardSession({ cards, testId, active, onExit }: { cards: VocabEntry[]; testId: string; active: boolean; onExit: () => void }) {
  const deck: DeckCard[] = useMemo(
    () =>
      cards.map((card) => {
        const words = [card.w, ...card.inflections];
        // ưu tiên câu ví dụ trong đề đang học
        const examples = [...card.examples].sort((a, b) => Number(b.testId === testId) - Number(a.testId === testId)).slice(0, 2);
        const hintText = examples[0]?.text ?? card.listenExample?.text;
        return {
          id: card.w,
          term: card.w,
          tag: [card.pos.length ? `(${card.pos.join(", ")})` : "", `có trong ${card.freq} đề`].filter(Boolean).join(" · "),
          meaning: card.meanings.join("; "),
          speak: card.w,
          hint: hintText ? <Blanked text={hintText} words={words} /> : undefined,
          details: (
            <div className="space-y-2.5">
              <OtherForms v={card} />
              {examples.map((ex) => (
                <div key={`${ex.testId}:${ex.number}`} className="rounded-xl border border-line p-3">
                  <div className="mb-1 text-xs text-muted">📖 Part 5 · {ex.testId.replace("-test", " · Test ")} · câu {ex.number}</div>
                  <Highlight text={ex.text} words={words} />
                </div>
              ))}
              {card.listenExample && (
                <div className="rounded-xl border border-line p-3">
                  <div className="mb-1 text-xs text-muted">
                    🎧 Part {card.listenExample.part} · {card.listenExample.testId.replace("-test", " · Test ")} · câu {card.listenExample.number}
                  </div>
                  <Highlight text={card.listenExample.text} words={words} />
                </div>
              )}
            </div>
          ),
        };
      }),
    [cards, testId],
  );
  return <FlashcardDeck cards={deck} active={active} onExit={onExit} />;
}

const PAGE = 30;

const STATUS_TABS: { key: Status | "all" | "starred"; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "new", label: "Mới" },
  { key: "learning", label: "Đang học" },
  { key: "mastered", label: "Đã thuộc" },
  { key: "starred", label: "★ Gắn sao" },
];

function WordList({ vocab, cards, testId }: { vocab: VocabEntry[]; cards: Record<string, VocabCard>; testId: string | null }) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string | "all">("all");
  const [status, setStatus] = useState<Status | "all" | "starred">("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const stars = useStars();
  const topRef = useRef<HTMLDivElement>(null);

  const query = q.trim().toLowerCase();
  const list = vocab.filter(
    (v) =>
      (pos === "all" || v.pos.includes(pos)) &&
      (status === "all" || (status === "starred" ? stars.has(v.w) : statusOf(cards[v.w]) === status)) &&
      (!query ||
        v.w.includes(query) ||
        v.inflections.some((f) => f.includes(query)) ||
        v.related.some((f) => f.w.includes(query)) ||
        v.meanings.some((m) => m.toLowerCase().includes(query))),
  );

  // bộ lọc ngoài (đề / phần) đổi làm danh sách ngắn lại → kẹp về trang cuối còn lại
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages);
  const pageList = list.slice((cur - 1) * PAGE, cur * PAGE);

  const where = (v: VocabEntry) => {
    if (!testId) return `${v.freq} đề`;
    const s = v.tests[testId] ?? {};
    return [s.l?.length ? `🎧 câu ${s.l.join(", ")}` : "", s.r?.length ? `📖 câu ${s.r.join(", ")}` : ""]
      .filter(Boolean)
      .join(" · ");
  };

  return (
    <div ref={topRef} className="mt-5 scroll-mt-20">
      <SearchBox
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        placeholder="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt…"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
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
        <SegmentedTabs
          label="Loại từ"
          size="sm"
          items={["all", ...Object.keys(POS_LABEL)].map((p) => ({
            key: p,
            label: p === "all" ? "Mọi loại từ" : p,
            title: p === "all" ? undefined : POS_LABEL[p],
          }))}
          value={pos}
          onChange={(v) => {
            setPos(v);
            setPage(1);
          }}
        />
      </div>
      <ListCount from={(cur - 1) * PAGE} shown={pageList.length} total={list.length} unit="từ" />

      <ul className="grid gap-2">
        {pageList.map((v) => {
          const expanded = open === v.w;
          return (
            <TermRow
              key={v.w}
              id={v.w}
              term={v.w}
              speak={v.w}
              meaning={v.meanings.join("; ")}
              card={cards[v.w]}
              starred={stars.has(v.w)}
              onReset={() => resetVocab(v.w)}
              tags={
                <>
                  {v.pos.map((p) => (
                    <span key={p} title={POS_LABEL[p] ?? p} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-semibold">
                      {p}
                    </span>
                  ))}
                  {v.basic && <span className="rounded-md bg-surface-2 px-1.5 py-0.5">cơ bản</span>}
                  <span className="ml-0.5">{where(v)}</span>
                </>
              }
              below={
                v.related.length > 0 && (
                  <>
                    <button
                      onClick={() => setOpen(expanded ? null : v.w)}
                      aria-expanded={expanded}
                      className="flex flex-wrap items-center gap-1.5 text-left text-xs"
                    >
                      <span className="text-muted">Dạng khác:</span>
                      {v.related.map((f) => (
                        <span key={f.w} className="rounded-full border border-line px-2 py-0.5 font-medium text-primary">
                          {f.w}
                        </span>
                      ))}
                      <span className={`text-muted transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden>
                        ▾
                      </span>
                    </button>
                    {expanded && (
                      <div className="step-fade mt-2">
                        <OtherForms v={v} />
                      </div>
                    )}
                  </>
                )
              }
            />
          );
        })}
      </ul>
      {!list.length && <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">Không có từ nào khớp.</div>}
      <Pagination
        page={cur}
        total={pages}
        onChange={(p) => {
          setPage(p);
          setOpen(null);
          topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
    </div>
  );
}
