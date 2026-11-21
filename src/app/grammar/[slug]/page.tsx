import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExamExample, GrammarBlock } from "@/components/GrammarContent";
import { TOPICS, topicBySlug } from "@/lib/grammar";
import { grammarExamples, practiceInfo } from "@/lib/grammar-examples";

export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/grammar/[slug]">): Promise<Metadata> {
  const t = topicBySlug((await params).slug);
  return { title: t ? `${t.title} · Ngữ pháp` : "Không tìm thấy bài" };
}

export default async function GrammarTopicPage({ params }: PageProps<"/grammar/[slug]">) {
  const topic = topicBySlug((await params).slug);
  if (!topic) notFound();
  const [examples, practice] = await Promise.all([grammarExamples(topic), practiceInfo(topic.practice)]);
  const i = TOPICS.indexOf(topic);
  const prev = TOPICS[i - 1];
  const next = TOPICS[i + 1];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Link href="/grammar" className="text-sm text-muted hover:text-fg">
        ← Ngữ pháp
      </Link>
      <div className="mt-3 text-xs font-semibold tracking-wide text-muted uppercase">
        Bài {i + 1} · {topic.group}
      </div>
      <h1 className="mt-1 text-3xl font-bold">{topic.title}</h1>
      <p className="mt-2 text-muted">{topic.summary}</p>

      {/* mục lục */}
      <nav aria-label="Mục lục" className="mt-6 flex flex-wrap gap-2 text-sm">
        {topic.sections.map((s, k) => (
          <a key={k} href={`#muc-${k + 1}`} className="rounded-full border border-line bg-surface px-3 py-1 text-muted hover:border-primary/40 hover:text-fg">
            {s.heading}
          </a>
        ))}
        {examples.length > 0 && (
          <a href="#trong-de" className="rounded-full border border-line bg-surface px-3 py-1 text-muted hover:border-primary/40 hover:text-fg">
            Câu hỏi trong đề
          </a>
        )}
      </nav>

      {topic.sections.map((s, k) => (
        <section key={k} id={`muc-${k + 1}`} className="mt-10 scroll-mt-24">
          <h2 className="text-xl font-bold">{s.heading}</h2>
          <div className="mt-4 space-y-4">
            {s.blocks.map((b, j) => (
              <GrammarBlock key={j} block={b} />
            ))}
          </div>
        </section>
      ))}

      {examples.length > 0 && (
        <section id="trong-de" className="mt-10 scroll-mt-24">
          <h2 className="text-xl font-bold">Câu hỏi trong đề</h2>
          <p className="mt-1 text-sm text-muted">Tự chọn đáp án trước, rồi bấm vào câu để xem đáp án và giải thích.</p>
          <div className="mt-4 space-y-3">
            {examples.map((ex, k) => (
              <ExamExample key={ex.key} ex={ex} index={k} />
            ))}
          </div>
        </section>
      )}

      {practice && (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary-soft p-5">
          <div>
            <div className="font-semibold">Luyện ngay: Part 5 · {practice.label}</div>
            <div className="text-sm text-muted">{practice.count} câu từ 48 đề, câu làm sai tự vào sổ câu sai.</div>
          </div>
          <Link
            href={`/practice/5/${practice.tag}?n=20`}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm shadow-primary/20 hover:opacity-90"
          >
            Luyện 20 câu
          </Link>
        </div>
      )}

      {/* nguồn đã dùng để đối chiếu nội dung bài */}
      <section className="mt-10 rounded-2xl border border-line bg-surface p-5 text-sm">
        <h2 className="font-semibold">Nguồn</h2>
        <ul className="mt-2 space-y-1.5">
          {topic.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {s.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* bài trước / bài sau */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link href={`/grammar/${prev.slug}`} className="rounded-xl border border-line bg-surface p-4 hover:border-primary/40">
            <div className="text-xs text-muted">← Bài trước</div>
            <div className="font-semibold">{prev.title}</div>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/grammar/${next.slug}`} className="rounded-xl border border-line bg-surface p-4 text-right hover:border-primary/40">
            <div className="text-xs text-muted">Bài sau →</div>
            <div className="font-semibold">{next.title}</div>
          </Link>
        )}
      </div>
    </main>
  );
}
