"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import SegmentedTabs from "./SegmentedTabs";

/** Chỉ cho quay về đường dẫn nội bộ (chống chuyển hướng ra ngoài) */
function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email hoặc mật khẩu không đúng.",
  INVALID_EMAIL: "Email không hợp lệ.",
  USER_ALREADY_EXISTS: "Email này đã có tài khoản — hãy đăng nhập.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Email này đã có tài khoản — hãy đăng nhập.",
  PASSWORD_TOO_SHORT: "Mật khẩu cần ít nhất 8 ký tự.",
  PASSWORD_TOO_LONG: "Mật khẩu quá dài (tối đa 128 ký tự).",
};

function errorText(e: { code?: string; status?: number; message?: string }) {
  if (e.status === 429) return "Thử quá nhiều lần, vui lòng đợi một lát rồi thử lại.";
  return (e.code && ERRORS[e.code]) || e.message || "Có lỗi xảy ra, vui lòng thử lại.";
}

const input = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2";

export default function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { data: session, isPending } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!isPending && session) {
    return (
      <div className="mt-8 rounded-xl border border-line bg-surface p-5">
        <p>
          Bạn đang đăng nhập với <b>{session.user.email}</b>.
        </p>
        <button
          type="button"
          onClick={() => router.push(next)}
          className="mt-4 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary"
        >
          Tiếp tục
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signin"
        ? await signIn.email({ email: email.trim(), password })
        : await signUp.email({ email: email.trim(), password, name: name.trim() || email.split("@")[0] });
    setBusy(false);
    if (error) setError(errorText(error));
    else router.push(next);
  }

  return (
    <form onSubmit={submit} className="mt-8 rounded-xl border border-line bg-surface p-5">
      <SegmentedTabs
        label="Đăng nhập hoặc tạo tài khoản"
        stretch
        items={[
          { key: "signin" as const, label: "Đăng nhập" },
          { key: "signup" as const, label: "Tạo tài khoản" },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
      />

      {mode === "signup" && (
        <label className="mt-4 block text-sm">
          Tên hiển thị
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="name"
            placeholder="vd Minh Anh"
            className={input}
          />
        </label>
      )}
      <label className="mt-4 block text-sm">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={input}
        />
      </label>
      <label className="mt-4 block text-sm">
        Mật khẩu{mode === "signup" && " (ít nhất 8 ký tự)"}
        <input
          type="password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className={input}
        />
      </label>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-on-primary disabled:opacity-60"
      >
        {busy ? "Đang xử lý…" : mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
      </button>
    </form>
  );
}
