import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ClientOnly from "@/components/ClientOnly";
import ExamRoom from "@/components/ExamRoom";
import { getTest, getTestIndex } from "@/lib/tests";
import { ExamSkeleton } from "@/components/Skeleton";

export async function generateStaticParams() {
  return (await getTestIndex()).map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/tests/[id]/exam">): Promise<Metadata> {
  const test = await getTest((await params).id);
  return { title: test ? `Làm bài · ${test.title}` : "Không tìm thấy đề" };
}

const loading = <ExamSkeleton />;

// params được đọc bên trong <Suspense> để điều hướng hiển thị ngay khung trang
export default function ExamPage({ params }: PageProps<"/tests/[id]/exam">) {
  return (
    <Suspense fallback={loading}>
      <ExamContent params={params} />
    </Suspense>
  );
}

async function ExamContent({ params }: { params: Promise<{ id: string }> }) {
  const test = await getTest((await params).id);
  if (!test) notFound();
  return (
    <ClientOnly fallback={loading}>
      <ExamRoom test={test} />
    </ClientOnly>
  );
}
