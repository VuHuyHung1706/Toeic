import Link from "next/link";
import { PARTS } from "@/lib/toeic";
import { getTestIndex } from "@/lib/tests";

export default async function Home() {
  const tests = await getTestIndex();
  const years = [...new Set(tests.map((t) => t.year))].sort();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12">
      <section className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Luyện thi TOEIC Listening & Reading</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">
            Phòng thi như thật,
            <br />
            giải thích bằng tiếng Việt.
          </h1>
          <p className="mt-4 max-w-xl text-muted">
            {tests.length} đề thi thử chuẩn định dạng 200 câu ({years[0]}–{years[years.length - 1]}). Bấm giờ 120 phút, quy đổi
            điểm 990, hoặc luyện riêng từng part với đáp án và giải thích chi tiết.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/tests" className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary hover:opacity-90">
              Vào kho đề
            </Link>
            <Link href="/history" className="rounded-lg border border-line bg-surface px-5 py-2.5 font-semibold hover:bg-surface-2">
              Lịch sử làm bài
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            [String(tests.length), "đề thi thử"],
            [String(tests.reduce((s, t) => s + t.questionCount, 0).toLocaleString("vi-VN")), "câu hỏi"],
            ["7", "part Listening & Reading"],
            ["990", "thang điểm quy đổi"],
          ].map(([n, label]) => (
            <div key={label} className="rounded-xl border border-line bg-surface p-5">
              <div className="text-3xl font-bold">{n}</div>
              <div className="mt-1 text-sm text-muted">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold">Cấu trúc đề thi</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PARTS.map((p) => (
            <div key={p.part} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted">
                <span>Part {p.part}</span>
                <span>{p.skill === "listening" ? "Nghe" : "Đọc"}</span>
              </div>
              <div className="mt-1 font-semibold">{p.name}</div>
              <div className="mt-1 text-sm text-muted">
                {p.count} câu · {p.desc}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
