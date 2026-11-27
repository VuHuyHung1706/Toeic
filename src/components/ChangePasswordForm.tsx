"use client";
// Form đổi mật khẩu: dùng ở trang cá nhân (3 ô một hàng) và trong hộp "Đổi mật khẩu" của menu tài khoản (compact: xếp dọc).

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { input, Notice, primaryBtn, viError, type Msg } from "./AccountUi";

export default function ChangePasswordForm({ onSaved, compact = false }: { onSaved?: () => void; compact?: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [others, setOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const mismatch = confirm.length > 0 && next !== confirm;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setMsg({ ok: false, text: "Mật khẩu mới cần ít nhất 8 ký tự" });
    if (next !== confirm) return setMsg({ ok: false, text: "Hai lần nhập mật khẩu mới chưa khớp" });
    if (next === current)
      return setMsg({
        ok: false,
        text: "Mật khẩu mới phải khác mật khẩu hiện tại",
      });
    setBusy(true);
    setMsg(null);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: others,
    });
    setBusy(false);
    if (error)
      return setMsg({
        ok: false,
        text: viError(error, "Chưa đổi được mật khẩu, thử lại sau"),
      });
    setCurrent("");
    setNext("");
    setConfirm("");
    setMsg({
      ok: true,
      text: others ? "Đã đổi mật khẩu và đăng xuất các thiết bị khác" : "Đã đổi mật khẩu",
    });
    onSaved?.();
  };

  return (
    <form onSubmit={save} className={`grid gap-3 ${compact ? "" : "sm:grid-cols-3"}`}>
      <label className="text-sm">
        Mật khẩu hiện tại
        <input
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className={input}
        />
      </label>
      <label className="text-sm">
        Mật khẩu mới
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
      <label className="text-sm">
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
      <label className={`flex items-center gap-2 text-sm ${compact ? "" : "sm:col-span-3"}`}>
        <input
          type="checkbox"
          checked={others}
          onChange={(e) => setOthers(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        Đăng xuất khỏi các thiết bị khác
      </label>
      <div className={compact ? "" : "sm:col-span-3"}>
        <button
          type="submit"
          disabled={busy || !current || !next || !confirm}
          className={`${primaryBtn} ${compact ? "w-full" : ""}`}
        >
          {busy ? "Đang đổi…" : "Đổi mật khẩu"}
        </button>
        <Notice msg={msg} />
      </div>
    </form>
  );
}
