"use client";
// Thanh điều hướng gọn ở đáy màn hình (luyện tập, xem lại đáp án):  [<]  [▦ Câu x/y]  [>]  — căn phải.
// Nút giữa bật/tắt bảng số câu.

import SmoothWidth from "./SmoothWidth";
import UiIcon from "./UiIcon";

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
          <UiIcon name="chevronLeft" className="size-5" />
        </button>
        <button
          onClick={onToggleList}
          aria-expanded={listOpen}
          aria-label={listOpen ? "Đóng danh sách câu hỏi" : "Mở danh sách câu hỏi"}
          className="flex h-10 items-center gap-2 rounded-lg bg-success px-4 text-sm font-semibold text-white tabular-nums hover:opacity-90"
        >
          {listOpen ? (
            <UiIcon name="close" className="size-4" />
          ) : (
            <UiIcon name="grid" className="size-4" />
          )}
          <SmoothWidth>{label}</SmoothWidth>
        </button>
        <button onClick={onNext} disabled={!canNext} aria-label="Câu sau" title="Câu sau (phím →)" className={arrow}>
          <UiIcon name="chevronRight" className="size-5" />
        </button>
      </div>
    </nav>
  );
}
