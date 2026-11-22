import type { Metadata } from "next";
import Link from "next/link";
import { GROUPS, TOPICS } from "@/lib/grammar";
import { getBankIndex } from "@/lib/tests";
import UiIcon from "@/components/UiIcon";

export const metadata: Metadata = { title: "Ngữ pháp TOEIC" };

export default async function GrammarPage() {
  const bank = await getBankIndex();
  const count = (tag?: string) => bank.find((t) => t.part === 5 && t.tag === tag)?.count;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Ngữ pháp TOEIC</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {TOPICS.length} chủ điểm ngữ pháp hay gặp ở Part 5–6: công thức, cách nhận biết trong đề, các bẫy thường gặp và ví dụ lấy từ
        chính các đề trong kho. Học xong mỗi bài có thể luyện ngay dạng câu tương ứng.
      </p>

      {GROUPS.map((g) => (
        <section key={g} className="mt-10">
          <h2 className="text-xl font-bold">{g}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.filter((t) => t.group === g).map((t) => {
              const c = count(t.practice);
              return (
                <Link
                  key={t.slug}
                  href={`/grammar/${t.slug}`}
                  className="group flex flex-col rounded-2xl border border-line bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 motion-reduce:hover:translate-y-0"
                >
                  <div className="text-xs font-semibold tracking-wide text-muted uppercase">Bài {TOPICS.indexOf(t) + 1}</div>
                  <div className="mt-0.5 text-lg leading-snug font-bold group-hover:text-primary">{t.title}</div>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{t.summary}</p>
                  {c != null && <div className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-primary">
                      Luyện {c} câu Part 5
                      <UiIcon name="arrowRight" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
