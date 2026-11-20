import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ClientOnly from "@/components/ClientOnly";
import TagSession from "@/components/TagSession";
import { getBankIndex } from "@/lib/tests";
import { QuestionSkeleton } from "@/components/Skeleton";

export async function generateStaticParams() {
  return (await getBankIndex()).map((t) => ({ part: String(t.part), tag: t.tag }));
}

export const metadata: Metadata = { title: "Luyện theo dạng câu" };

const loading = <QuestionSkeleton />;

export default function TagPracticePage({ params }: PageProps<"/practice/[part]/[tag]">) {
  return (
    <Suspense fallback={loading}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ part: string; tag: string }> }) {
  const { part, tag } = await params;
  const info = (await getBankIndex()).find((t) => String(t.part) === part && t.tag === tag);
  if (!info) notFound();
  return (
    <ClientOnly fallback={loading}>
      <TagSession part={info.part} tag={info.tag} label={info.label} />
    </ClientOnly>
  );
}
