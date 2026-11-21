"use client";

import { useLayoutEffect, useRef } from "react";

/** Nhóm nút liền khối; nền xanh của nút đang chọn trượt sang nút mới (lọc năm ở Kho đề, lọc năm/đề ở Từ vựng) */
export default function SegmentedTabs<K extends string | number>({
  label,
  items,
  value,
  onChange,
}: {
  /** tên nhóm cho trình đọc màn hình */
  label: string;
  items: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  // đặt nền dưới nút đang chọn (chỉnh thẳng style, không qua state → không render lại)
  const place = (animate: boolean) => {
    const wrap = wrapRef.current;
    const pill = pillRef.current;
    const el = wrap?.querySelector<HTMLElement>("[aria-selected=true]");
    if (!pill || !el) return;
    pill.style.transition = animate ? "" : "none";
    pill.style.width = `${el.offsetWidth}px`;
    pill.style.transform = `translateX(${el.offsetLeft}px)`;
    pill.style.opacity = "1";
  };
  const placeRef = useRef(place);
  useLayoutEffect(() => {
    placeRef.current = place;
  });

  // đổi lựa chọn → trượt (lần đầu thì đặt ngay)
  useLayoutEffect(() => {
    placeRef.current(placed.current);
    placed.current = true;
  }, [value]);

  // đổi kích thước (xoay màn hình, đổi phông…) → đặt lại ngay, không trượt. Tạo một lần duy nhất:
  // ResizeObserver gọi ngay khi bắt đầu theo dõi, tạo lại mỗi lần đổi lựa chọn sẽ cắt mất hiệu ứng trượt.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => placeRef.current(false));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1"
      role="tablist"
      aria-label={label}
    >
      <span
        ref={pillRef}
        aria-hidden
        className="absolute top-1 bottom-1 left-0 rounded-xl bg-primary opacity-0 shadow-sm transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      />
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={value === it.key}
          onClick={() => onChange(it.key)}
          className={`relative shrink-0 rounded-xl px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-300 ${
            value === it.key ? "text-on-primary" : "text-muted hover:text-fg"
          }`}
        >
          {it.label}
          {it.count != null && <span className="ml-1.5 text-xs opacity-70">{it.count.toLocaleString("vi-VN")}</span>}
        </button>
      ))}
    </div>
  );
}
