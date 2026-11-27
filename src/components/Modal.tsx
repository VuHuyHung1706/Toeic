"use client";
// Bảng nổi giữa màn hình (dùng cho "Trang cá nhân" và "Đổi mật khẩu" trong menu tài khoản):
// nền mờ phủ cả trang, Esc / bấm ra nền / nút × để đóng, nội dung dài thì cuộn trong bảng.
// Portal ra <body>: menu nằm trong header có backdrop-blur → phần tử fixed bên trong bị giới hạn trong header.

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import UiIcon, { type UiIconName } from "./UiIcon";

export default function Modal({
  open,
  onClose,
  title,
  icon,
  size = "sm",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: UiIconName;
  /** sm: hộp nhỏ (form ngắn) · md: bảng rộng hơn (trang cá nhân) */
  size?: "sm" | "md";
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // đang mở hộp xác nhận đè lên (vd "Xoá tài khoản?") → Esc chỉ đóng hộp đó, giữ nguyên bảng này
      if (e.key !== "Escape" || document.querySelector('[aria-hidden="false"] > [role="alertdialog"]')) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    // khoá cuộn trang phía sau khi bảng đang mở
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      onClick={onClose}
      className="step-fade fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[88dvh] w-full flex-col rounded-2xl border border-line bg-surface shadow-2xl ${
          size === "md" ? "max-w-xl" : "max-w-sm"
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 px-5 pt-5 pb-3">
          {icon && (
            <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary">
              <UiIcon name={icon} className="size-4" />
            </span>
          )}
          <h2 className="flex-1 font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <UiIcon name="close" className="size-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
