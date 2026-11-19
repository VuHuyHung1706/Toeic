import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ClientOnly from "@/components/ClientOnly";
import ResultView from "@/components/ResultView";
import { getTest, getTestIndex } from "@/lib/tests";

export async function generateStaticParams() {
  return (await getTestIndex()).map((t) => ({ id: t.id }));
}

export const metadata: Metadata = { title: "Kết quả" };

const loading = <div className="grid flex-1 place-items-center p-10 text-muted">Đang tải kết quả…</div>;

export default function ResultPage({ params }: PageProps<"/tests/[id]/result">) {
  return (
    <Suspense fallback={loading}>
      <ResultContent params={params} />
    </Suspense>
  );
}

async function ResultContent({ params }: { params: Promise<{ id: string }> }) {
  const test = await getTest((await params).id);
  if (!test) notFound();
  return (
    <ClientOnly fallback={loading}>
      <ResultView test={test} />
    </ClientOnly>
  );
}
