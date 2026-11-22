"use client";
// Hộp thoại xác nhận cùng kiểu với web (thay cho confirm() mặc định của trình duyệt):
// nền mờ dần, hộp phóng nhẹ vào; Esc / bấm ra ngoài = huỷ; nút xác nhận được focus sẵn (Enter để đồng ý).

import { useEffect, useRef, type ReactNode } from "react";

export default function ConfirmDialog({
  open,
  title,
  children,
  icon,
  confirmLabel,
  cancelLabel = "Ở lại",
  tone = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  /** biểu tượng tròn phía trên tiêu đề */
  icon?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** primary: xanh (mặc định) · accent: cam như nút Nộp bài · danger: đỏ */
  tone?: "primary" | "accent" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const btn =
    tone === "accent"
      ? "bg-[#f7941d] text-white hover:brightness-110"
      : tone === "danger"
        ? "bg-danger text-white hover:opacity-90"
        : "bg-primary text-on-primary hover:opacity-90";

  return (
    <div
      inert={!open}
      aria-hidden={!open}
      onClick={onCancel}
      className={`fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-2xl transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
          open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {icon && <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary-soft text-primary">{icon}</div>}
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        {children && <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-surface-2">
            {cancelLabel}
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} className={`rounded-lg px-4 py-2.5 font-semibold ${btn}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Biểu tượng cửa ra (thoát) */
export const ExitIcon = (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17l-5-5 5-5M5 12h11" />
  </svg>
);

/** Biểu tượng nộp bài (dấu tích trong khung) */
export const SubmitIcon = (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);
