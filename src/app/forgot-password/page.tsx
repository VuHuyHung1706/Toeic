import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/PasswordReset";
import { TextSkeleton } from "@/components/Skeleton";

export const metadata: Metadata = { title: "Quên mật khẩu" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">Quên mật khẩu</h1>
      <p className="mt-2 text-sm text-muted">Nhập email đã đăng ký, chúng tôi sẽ gửi link để bạn đặt mật khẩu mới.</p>
      <Suspense fallback={<TextSkeleton label="Đang tải" lines={2} className="mt-8" />}>
        <ForgotPasswordForm />
      </Suspense>
    </main>
  );
}
