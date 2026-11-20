"use client";
// Nút nổi "Câu hỏi" (góc dưới phải) bật/tắt ngăn bảng số câu:
// máy tính → ngăn bên phải; điện thoại → trượt từ dưới lên. Mở ra tự cuộn tới câu đang xem, Esc để đóng.
// Dùng chung cho phòng luyện tập và trang xem lại đáp án.

import { useEffect, useRef, type ReactNode } from "react";

export default function QuestionDrawer({
  open,
  onOpenChange,
  title = "Câu hỏi",
  summary,
  badge,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** dòng tóm tắt ở đầu ngăn, vd "Đã làm 12/60" */
  summary?: ReactNode;
  /** chữ nhỏ trên nút khi ngăn đóng, vd "12/60" */
  badge?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector("[data-current]")?.scrollIntoView({ block: "center" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => onOpenChange(false)}>
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Danh sách câu hỏi"
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-surface p-4 pb-24 shadow-xl lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-80 lg:rounded-none lg:rounded-l-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{title}</h2>
              {summary && <span className="text-sm text-muted">{summary}</span>}
            </div>
            {children}
          </div>
        </div>
      )}
      <button
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={open ? "Đóng danh sách câu hỏi" : "Mở danh sách câu hỏi"}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[45] flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary/30 hover:opacity-90"
      >
        {open ? (
          <span aria-hidden className="text-base leading-none">
            ✕
          </span>
        ) : (
          <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="currentColor">
            <path d="M3 3h4v4H3zM8 3h4v4H8zM13 3h4v4h-4zM3 8h4v4H3zM8 8h4v4H8zM13 8h4v4h-4zM3 13h4v4H3zM8 13h4v4H8zM13 13h4v4h-4z" />
          </svg>
        )}
        {open ? "Đóng" : title}
        {!open && badge && <span className="rounded-full bg-on-primary/20 px-1.5 text-xs tabular-nums">{badge}</span>}
      </button>
    </>
  );
}
