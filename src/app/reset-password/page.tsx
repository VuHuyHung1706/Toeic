import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/PasswordReset";
import { TextSkeleton } from "@/components/Skeleton";

export const metadata: Metadata = { title: "Đặt mật khẩu mới", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">Đặt mật khẩu mới</h1>
      <Suspense fallback={<TextSkeleton label="Đang tải" lines={2} className="mt-8" />}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
