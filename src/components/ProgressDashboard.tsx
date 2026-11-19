"use client";

import { useMemo, useState } from "react";
import { useAttempts, useDictation, useReviews } from "@/lib/storage";
import { PARTS, formatDuration } from "@/lib/toeic";
import type { Attempt, PartNo } from "@/lib/types";

const DAY = 86_400_000;
const WEEKS = 16;

function dayKey(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function ProgressDashboard() {
  const attempts = useAttempts();
  const reviews = useReviews();
  const dictation = useDictation();
  // "hôm nay" cố định cho lần mở trang (render phải thuần, không gọi Date.now trong render)
  const [today] = useState(() => startOfDay(Date.now()));

  const stats = useMemo(() => {
    const activity = new Map<string, number>();
    const add = (t: number, n: number) => activity.set(dayKey(t), (activity.get(dayKey(t)) ?? 0) + n);
    let answered = 0;
    let presented = 0;
    let correct = 0;
    let seconds = 0;
    const byPart = new Map<PartNo, { correct: number; total: number }>();
    for (const a of attempts) {
      const n = Object.keys(a.answers).length;
      answered += n;
      presented += a.total;
      correct += a.correct;
      seconds += a.durationSec;
      add(a.submittedAt, n);
      for (const [p, r] of Object.entries(a.byPart)) {
        const cur = byPart.get(Number(p) as PartNo) ?? { correct: 0, total: 0 };
        cur.correct += r!.correct;
        cur.total += r!.total;
        byPart.set(Number(p) as PartNo, cur);
      }
    }
    for (const list of Object.values(reviews)) for (const r of list) add(r.at, 1);
    for (const d of dictation) add(d.at, 1);

    // chuỗi ngày học liên tiếp (tính đến hôm nay, hoặc hôm qua nếu hôm nay chưa học)
    let streak = 0;
    let t = today;
    if (!activity.get(dayKey(t))) t -= DAY;
    while (activity.get(dayKey(t))) {
      streak += 1;
      t -= DAY;
    }
    return { activity, answered, presented, correct, seconds, byPart, streak };
  }, [attempts, reviews, dictation, today]);

  const fulls = attempts.filter((a) => a.mode === "full").slice().reverse();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Câu đã làm" value={stats.answered.toLocaleString("vi-VN")} />
        <Stat label="Tỉ lệ đúng (tính cả câu bỏ trống)" value={stats.presented ? `${Math.round((stats.correct / stats.presented) * 100)}%` : "—"} />
        <Stat label="Thời gian làm bài" value={formatDuration(stats.seconds)} />
        <Stat label="Chuỗi ngày học" value={`${stats.streak} ngày`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Điểm thi thử theo thời gian</h2>
          <p className="text-xs text-muted">Điểm ước tính thang 990, mỗi điểm là một lần thi thử full đề</p>
          {fulls.length ? <ScoreChart attempts={fulls} /> : <Empty text="Làm một bài thi thử full để thấy biểu đồ điểm." />}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Tỉ lệ đúng theo part</h2>
          <p className="text-xs text-muted">Gộp mọi lần thi thử và luyện tập</p>
          <div className="mt-4 space-y-3">
            {PARTS.map((p) => {
              const r = stats.byPart.get(p.part);
              const pct = r?.total ? (r.correct / r.total) * 100 : 0;
              return (
                <div key={p.part} title={r ? `${r.correct}/${r.total} câu đúng` : "Chưa làm"}>
                  <div className="flex justify-between text-sm">
                    <span>
                      Part {p.part} <span className="text-muted">· {p.name}</span>
                    </span>
                    <span className="tabular-nums text-muted">{r?.total ? `${Math.round(pct)}% · ${r.correct}/${r.total}` : "—"}</span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-surface-2">
                    <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Lịch học {WEEKS} tuần gần nhất</h2>
        <p className="text-xs text-muted">Ô càng đậm, ngày đó làm càng nhiều câu (gồm thi thử, luyện tập, ôn câu sai, luyện nghe)</p>
        <Heatmap activity={stats.activity} today={today} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="mt-4 grid h-48 place-items-center rounded-lg bg-surface-2 text-sm text-muted">{text}</div>;
}

// ---------------------------------------------------------------------------
// Biểu đồ đường: 1 chuỗi (tổng điểm), crosshair + tooltip khi rê chuột
// ---------------------------------------------------------------------------
function ScoreChart({ attempts }: { attempts: Attempt[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 240;
  const pad = { l: 40, r: 16, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const ticks = [0, 250, 500, 750, 990];
  const x = (i: number) => pad.l + (attempts.length === 1 ? iw / 2 : (i / (attempts.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / 990) * ih;
  const pts = attempts.map((a, i) => [x(i), y(a.totalScore ?? 0)] as const);
  const h = hover !== null ? attempts[hover] : null;
  const fmt = (t: number) => new Date(t).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

  return (
    <div className="relative mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Biểu đồ điểm thi thử theo thời gian">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        <text x={pts[0][0]} y={H - 8} textAnchor={attempts.length === 1 ? "middle" : "start"} fontSize={11} fill="var(--muted)">
          {fmt(attempts[0].submittedAt)}
        </text>
        {attempts.length > 1 && (
          <text x={pts[pts.length - 1][0]} y={H - 8} textAnchor="end" fontSize={11} fill="var(--muted)">
            {fmt(attempts[attempts.length - 1].submittedAt)}
          </text>
        )}
        {hover !== null && (
          <line x1={pts[hover][0]} x2={pts[hover][0]} y1={pad.t} y2={pad.t + ih} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
        )}
        {pts.length > 1 && (
          <polyline
            points={pts.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={hover === i ? 6 : 4} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
        ))}
        {/* vùng bắt chuột rộng hơn điểm */}
        {pts.map(([px], i) => {
          const half = attempts.length === 1 ? iw / 2 : iw / (attempts.length - 1) / 2;
          return (
            <rect
              key={i}
              x={px - half}
              y={pad.t}
              width={half * 2}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(pts[hover][0] / W) * 100}%`, top: `${(pts[hover][1] / H) * 100}%`, marginTop: -10 }}
        >
          <div className="font-semibold">{h.testTitle}</div>
          <div className="text-muted">{new Date(h.submittedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</div>
          <div className="mt-1 tabular-nums">
            Tổng <b>{h.totalScore}</b> · L {h.listeningScore} · R {h.readingScore}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap hoạt động: tuần theo cột, thứ theo hàng, thang tuần tự một màu
// ---------------------------------------------------------------------------
function Heatmap({ activity, today }: { activity: Map<string, number>; today: number }) {
  // cột cuối là tuần hiện tại, hàng 0 = thứ Hai
  const dow = (new Date(today).getDay() + 6) % 7;
  const start = today - (dow + (WEEKS - 1) * 7) * DAY;
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => start + i * DAY);
  const max = Math.max(1, ...days.map((d) => activity.get(dayKey(d)) ?? 0));
  const level = (n: number) => (n <= 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const shade = ["var(--surface-2)", "25%", "50%", "75%", "100%"];
  const fill = (l: number) => (l === 0 ? shade[0] : `color-mix(in oklab, var(--primary) ${shade[l]}, var(--surface))`);
  const total = days.reduce((s, d) => s + (activity.get(dayKey(d)) ?? 0), 0);

  return (
    <div className="mt-4">
      <div className="flex gap-3 overflow-x-auto pb-1">
        <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-0 text-[10px] leading-3 text-muted">
          {["T2", "", "T4", "", "T6", "", "CN"].map((d, i) => (
            <span key={i} className="h-3">
              {d}
            </span>
          ))}
        </div>
        <div className="grid shrink-0 grid-flow-col grid-rows-7 gap-[3px]">
          {days.map((d) => {
            const n = activity.get(dayKey(d)) ?? 0;
            const future = d > today;
            return (
              <div
                key={d}
                title={`${new Date(d).toLocaleDateString("vi-VN")}: ${n} câu`}
                aria-label={`${new Date(d).toLocaleDateString("vi-VN")}: ${n} câu`}
                className="size-3 rounded-[3px]"
                style={{ background: future ? "transparent" : fill(level(n)) }}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span>{total.toLocaleString("vi-VN")} câu trong {WEEKS} tuần</span>
        <span className="ml-auto">Ít</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-3 rounded-[3px]" style={{ background: fill(l) }} />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  );
}
