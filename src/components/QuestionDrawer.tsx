"use client";
// Nút nổi "Câu hỏi" (góc dưới phải) bật/tắt ngăn bảng số câu:
// máy tính → ngăn bên phải; điện thoại → trượt từ dưới lên. Mở ra tự cuộn tới câu đang xem, Esc để đóng.
// Dùng chung cho phòng luyện tập và trang xem lại đáp án.

import { useEffect, useRef, type ReactNode } from "react";
import UiIcon from "./UiIcon";

export default function QuestionDrawer({
  open,
  onOpenChange,
  title = "Câu hỏi",
  summary,
  badge,
  showButton = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** dòng tóm tắt ở đầu ngăn, vd "Đã làm 12/60" */
  summary?: ReactNode;
  /** chữ nhỏ trên nút khi ngăn đóng, vd "12/60" */
  badge?: ReactNode;
  /** false: nút bật/tắt nằm ở chỗ khác (vd thanh điều hướng StepNav) */
  showButton?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // cuộn trong ngăn tới câu đang xem (không dùng scrollIntoView để trang phía sau không bị cuộn theo)
    const panel = panelRef.current;
    const cur = panel?.querySelector<HTMLElement>("[data-current]");
    if (panel && cur) panel.scrollTop = cur.offsetTop - panel.clientHeight / 2 + cur.offsetHeight / 2;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <>
      {/* luôn nằm trong DOM để có hiệu ứng: nền mờ dần, ngăn trượt vào (máy tính: từ phải; điện thoại: từ dưới) */}
      <div
        inert={!open}
        aria-hidden={!open}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => onOpenChange(false)}
      >
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Danh sách câu hỏi"
            className={`absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-4 pb-24 shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform motion-reduce:transition-none lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-80 lg:rounded-none lg:rounded-l-2xl ${
              open ? "translate-y-0 lg:translate-x-0" : "translate-y-full lg:translate-x-full lg:translate-y-0"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{title}</h2>
              {summary && <span className="text-sm text-muted">{summary}</span>}
            </div>
            {children}
          </div>
      </div>
      {showButton && <button
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={open ? "Đóng danh sách câu hỏi" : "Mở danh sách câu hỏi"}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[45] flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary/30 hover:opacity-90"
      >
        {open ? (
          <UiIcon name="close" className="size-4" />
        ) : (
          <UiIcon name="grid" className="size-4" />
        )}
        {open ? "Đóng" : title}
        {!open && badge && <span className="rounded-full bg-on-primary/20 px-1.5 text-xs tabular-nums">{badge}</span>}
      </button>}
    </>
  );
}
