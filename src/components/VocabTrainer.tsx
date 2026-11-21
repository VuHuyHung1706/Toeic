"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { VOCAB_INTERVALS, resetVocab, reviewVocab, setPref, usePref, useVocabCards, type VocabCard } from "@/lib/storage";
import type { VocabEntry } from "@/lib/types";
import SegmentedTabs from "./SegmentedTabs";
import { CardsSkeleton } from "./Skeleton";
import SmoothWidth from "./SmoothWidth";

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

export default function VocabTrainer({ tests }: { tests: TestRef[] }) {
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
  return <Trainer allVocab={allVocab} tests={tests} />;
}

function Trainer({ allVocab, tests }: { allVocab: VocabEntry[]; tests: TestRef[] }) {
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

  if (session) return <FlashcardSession cards={session} testId={testId} onExit={() => setSession(null)} />;

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

function FlashcardSession({ cards: initial, testId, onExit }: { cards: VocabEntry[]; testId: string; onExit: () => void }) {
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

  const words = [card.w, ...card.inflections];
  // ưu tiên câu ví dụ trong đề đang học
  const examples = [...card.examples].sort((a, b) => Number(b.testId === testId) - Number(a.testId === testId)).slice(0, 2);
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

      {/* thẻ là div (không phải button) để các nút bên trong hợp lệ; phím Space lật thẻ */}
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
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <PosChips pos={card.pos} />
          {card.related.length > 0 && <span className="text-xs text-muted">· {card.related.length} dạng khác</span>}
          <span className="text-xs text-muted">· có trong {card.freq} đề</span>
        </div>
        {flipped ? (
          <div className="mt-6 space-y-3 text-left">
            <div className="text-center text-xl font-semibold text-primary">{card.meanings.join("; ")}</div>
            <OtherForms v={card} />
            {examples.map((ex) => (
              <div key={`${ex.testId}:${ex.number}`} className="rounded-lg border border-line p-3 text-sm">
                <div className="mb-1 text-xs text-muted">📖 Part 5 · {ex.testId.replace("-test", " · Test ")} · câu {ex.number}</div>
                <Highlight text={ex.text} words={words} />
              </div>
            ))}
            {card.listenExample && (
              <div className="rounded-lg border border-line p-3 text-sm">
                <div className="mb-1 text-xs text-muted">
                  🎧 Part {card.listenExample.part} · {card.listenExample.testId.replace("-test", " · Test ")} · câu{" "}
                  {card.listenExample.number}
                </div>
                <Highlight text={card.listenExample.text} words={words} />
              </div>
            )}
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

function WordList({ vocab, cards, testId }: { vocab: VocabEntry[]; cards: Record<string, VocabCard>; testId: string | null }) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const query = q.trim().toLowerCase();
  const list = vocab.filter(
    (v) =>
      (pos === "all" || v.pos.includes(pos)) &&
      (status === "all" || statusOf(cards[v.w]) === status) &&
      (!query ||
        v.w.includes(query) ||
        v.inflections.some((f) => f.includes(query)) ||
        v.related.some((f) => f.w.includes(query)) ||
        v.meanings.some((m) => m.toLowerCase().includes(query))),
  );

  const where = (v: VocabEntry) => {
    if (!testId) return `${v.freq} đề`;
    const s = v.tests[testId] ?? {};
    return [s.l?.length ? `🎧 câu ${s.l.join(", ")}` : "", s.r?.length ? `📖 câu ${s.r.join(", ")}` : ""]
      .filter(Boolean)
      .join(" · ");
  };

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
        <SegmentedTabs
          label="Loại từ"
          size="sm"
          items={["all", ...Object.keys(POS_LABEL)].map((p) => ({
            key: p,
            label: p === "all" ? "Tất cả" : p,
            title: p === "all" ? undefined : POS_LABEL[p],
          }))}
          value={pos}
          onChange={setPos}
        />
      </div>
      <div className="mt-2 text-sm text-muted">{list.length.toLocaleString("vi-VN")} từ · bấm vào từ để xem các dạng khác của từ</div>

      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
        {list.slice(0, limit).map((v) => {
          const st = statusOf(cards[v.w]);
          const expanded = open === v.w;
          const extra = v.related.length;
          return (
            <div key={v.w} className="border-b border-line last:border-0">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setOpen(expanded ? null : v.w)}
                onKeyDown={(e) => e.key === "Enter" && setOpen(expanded ? null : v.w)}
                className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-surface-2"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(v.w);
                  }}
                  aria-label={`Nghe phát âm ${v.w}`}
                  className="pt-0.5 text-sm opacity-70 hover:opacity-100"
                >
                  🔊
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-semibold">{v.w}</span>
                    {v.basic && <span className="text-xs text-muted">(cơ bản)</span>}
                    <PosChips pos={v.pos} />
                    <span className="text-sm">{v.meanings.join("; ")}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                    <span>{where(v)}</span>
                    {extra > 0 && (
                      <span className="text-primary">
                        {expanded ? "▾" : "▸"} {v.related.length} dạng khác: {v.related.map((f) => f.w).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    st === "mastered" ? "bg-success-soft text-success" : st === "learning" ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted"
                  }`}
                >
                  {st === "mastered" ? "Đã thuộc" : st === "learning" ? `Hộp ${cards[v.w].box}` : "Mới"}
                </span>
                {st !== "new" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetVocab(v.w);
                    }}
                    className="text-xs text-muted hover:text-danger"
                    title="Học lại từ đầu"
                  >
                    ↺
                  </button>
                )}
              </div>
              {expanded && extra > 0 && (
                <div className="px-4 pb-3 pl-11">
                  <OtherForms v={v} />
                </div>
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
