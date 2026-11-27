// Phần dùng chung của trang cá nhân và hộp đổi mật khẩu trong menu tài khoản: kiểu ô nhập / nút, câu lỗi, dòng thông báo.
import UiIcon from "./UiIcon";

export const input =
  "mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary";
export const primaryBtn =
  "rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary transition hover:opacity-90 disabled:opacity-50";
export const ghostBtn =
  "rounded-xl border border-line px-4 py-2 font-medium transition hover:bg-surface-2 disabled:opacity-50";

/** Lỗi của better-auth → câu tiếng Việt */
export function viError(err: { code?: string; message?: string } | null | undefined, fallback: string) {
  switch (err?.code) {
    case "INVALID_PASSWORD":
      return "Mật khẩu không đúng";
    case "PASSWORD_TOO_SHORT":
      return "Mật khẩu mới cần ít nhất 8 ký tự";
    case "PASSWORD_TOO_LONG":
      return "Mật khẩu mới quá dài (tối đa 128 ký tự)";
    case "SESSION_EXPIRED":
      return "Phiên đăng nhập đã cũ, hãy đăng nhập lại rồi thử";
    case "TOO_MANY_REQUESTS":
      return "Thử quá nhiều lần, vui lòng đợi vài phút";
  }
  if (err?.message?.includes("Too many")) return "Thử quá nhiều lần, vui lòng đợi vài phút";
  return fallback;
}

export type Msg = { ok: boolean; text: string } | null;

/** Dòng thông báo sau khi lưu (xanh: xong, đỏ: lỗi) */
export function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p
      role={msg.ok ? "status" : "alert"}
      className={`mt-3 flex items-center gap-1.5 text-sm ${msg.ok ? "text-success" : "text-danger"}`}
    >
      <UiIcon name={msg.ok ? "check" : "close"} className="size-4" />
      {msg.text}
    </p>
  );
}
