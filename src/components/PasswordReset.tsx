"use client";
// Quên mật khẩu: (1) nhập email → server gửi link (lib/mail.ts); (2) mở link → đặt mật khẩu mới.
// better-auth: /request-password-reset gửi link /api/auth/reset-password/<token>?callbackURL=/reset-password,
// link đó kiểm tra mã rồi chuyển về /reset-password?token=… (hoặc ?error=INVALID_TOKEN khi hết hạn / sai).

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { input, Notice, primaryBtn, viError, type Msg } from "./AccountUi";

const card = "mt-8 rounded-2xl border border-line bg-surface p-5";

export function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const to = email.trim();
    const { error } = await authClient.requestPasswordReset({ email: to, redirectTo: "/reset-password" });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: viError(error, "Chưa gửi được email, thử lại sau") });
    setSentTo(to);
  };

  if (sentTo) {
    return (
      <div className={card}>
        <p className="font-semibold">Kiểm tra hộp thư của bạn</p>
        <p className="mt-2 text-sm text-muted">
          Nếu <b className="text-fg">{sentTo}</b> đã đăng ký tài khoản, chúng tôi vừa gửi link đặt lại mật khẩu (hết hạn
          sau 30 phút). Không thấy thì xem thêm mục Spam / Quảng cáo.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <Link href="/login" className={primaryBtn}>
            Về trang đăng nhập
          </Link>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="rounded-xl border border-line px-4 py-2 font-medium hover:bg-surface-2"
          >
            Gửi lại / đổi email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={card}>
      <label className="block text-sm">
        Email đã đăng ký
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={input}
        />
      </label>
      <button type="submit" disabled={busy || !email.trim()} className={`${primaryBtn} mt-5 w-full py-2.5`}>
        {busy ? "Đang gửi…" : "Gửi link đặt lại mật khẩu"}
      </button>
      <Notice msg={msg} />
      <p className="mt-4 text-center text-sm text-muted">
        Nhớ ra rồi?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const invalid = params.get("error") === "INVALID_TOKEN" || !token;
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const mismatch = confirm.length > 0 && next !== confirm;

  if (invalid) {
    return (
      <div className={card}>
        <p className="font-semibold text-danger">Link không hợp lệ hoặc đã hết hạn</p>
        <p className="mt-2 text-sm text-muted">
          Mỗi link chỉ dùng được một lần và hết hạn sau 30 phút. Hãy gửi link mới.
        </p>
        <Link href="/forgot-password" className={`${primaryBtn} mt-5 inline-block text-sm`}>
          Gửi link mới
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className={card}>
        <p className="font-semibold text-success">Đã đặt mật khẩu mới</p>
        <p className="mt-2 text-sm text-muted">
          Mọi thiết bị đã được đăng xuất. Đăng nhập lại bằng mật khẩu mới để tiếp tục học.
        </p>
        <Link href="/login" className={`${primaryBtn} mt-5 inline-block text-sm`}>
          Đăng nhập
        </Link>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setMsg({ ok: false, text: "Mật khẩu mới cần ít nhất 8 ký tự" });
    if (next !== confirm) return setMsg({ ok: false, text: "Hai lần nhập mật khẩu mới chưa khớp" });
    setBusy(true);
    setMsg(null);
    const { error } = await authClient.resetPassword({ newPassword: next, token });
    setBusy(false);
    if (error) {
      const expired = error.code === "INVALID_TOKEN";
      return setMsg({
        ok: false,
        text: expired
          ? "Link đã hết hạn hoặc đã được dùng, hãy gửi link mới"
          : viError(error, "Chưa đặt được mật khẩu, thử lại sau"),
      });
    }
    setDone(true);
  };

  return (
    <form onSubmit={submit} className={card}>
      <label className="block text-sm">
        Mật khẩu mới (ít nhất 8 ký tự)
        <input
          type="password"
          required
          minLength={8}
          maxLength={128}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          className={input}
        />
      </label>
      <label className="mt-4 block text-sm">
        Nhập lại mật khẩu mới
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          aria-invalid={mismatch}
          className={`${input} ${mismatch ? "border-danger" : ""}`}
        />
      </label>
      <button type="submit" disabled={busy || !next || !confirm} className={`${primaryBtn} mt-5 w-full py-2.5`}>
        {busy ? "Đang lưu…" : "Đặt mật khẩu mới"}
      </button>
      <Notice msg={msg} />
    </form>
  );
}
