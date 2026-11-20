"use client";
// Thanh điều hướng gọn ở đáy màn hình (luyện tập, xem lại đáp án):  [<]  [▦ Câu x/y]  [>]  — căn phải.
// Nút giữa bật/tắt bảng số câu.

export default function StepNav({
  label,
  canPrev,
  canNext,
  onPrev,
  onNext,
  listOpen,
  onToggleList,
}: {
  /** vd "Câu 2/67" */
  label: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  listOpen: boolean;
  onToggleList: () => void;
}) {
  const arrow = "grid size-10 place-items-center rounded-lg bg-primary text-on-primary hover:opacity-90 disabled:opacity-35";
  return (
    <nav
      aria-label="Chuyển câu"
      className="fixed inset-x-0 bottom-0 z-[45] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-4 py-2">
        <button onClick={onPrev} disabled={!canPrev} aria-label="Câu trước" title="Câu trước (phím ←)" className={arrow}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <button
          onClick={onToggleList}
          aria-expanded={listOpen}
          aria-label={listOpen ? "Đóng danh sách câu hỏi" : "Mở danh sách câu hỏi"}
          className="flex h-10 items-center gap-2 rounded-lg bg-success px-4 text-sm font-semibold text-white tabular-nums hover:opacity-90"
        >
          {listOpen ? (
            <span aria-hidden>✕</span>
          ) : (
            <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="5.5" height="5.5" rx="1" />
              <rect x="11.5" y="3" width="5.5" height="5.5" rx="1" />
              <rect x="3" y="11.5" width="5.5" height="5.5" rx="1" />
              <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1" />
            </svg>
          )}
          {label}
        </button>
        <button onClick={onNext} disabled={!canNext} aria-label="Câu sau" title="Câu sau (phím →)" className={arrow}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
