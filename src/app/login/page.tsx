import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">Đăng nhập</h1>
      <p className="mt-2 text-sm text-muted">
        Đăng nhập để lưu bài làm, sổ câu sai và từ vựng lên tài khoản, học tiếp trên mọi thiết bị. Không đăng nhập vẫn
        dùng được — dữ liệu khi đó chỉ nằm trên trình duyệt này.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Đang tải…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
