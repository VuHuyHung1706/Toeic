"use client";
// Thanh chọn một trong nhiều mục, có nền (hoặc gạch chân) trượt sang mục vừa chọn.
// Dùng cho mọi nhóm nút kiểu tab/lọc trên web; menu đầu trang dùng chung phần trượt (useSlidingIndicator).

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import SmoothWidth from "./SmoothWidth";

/**
 * Đặt phần tử `indicator` khớp với phần tử con của `wrap` khớp `activeSelector`.
 * - Đổi mục chọn (deps đổi) → trượt; lần đầu hoặc khi trước đó đang ẩn → đặt ngay rồi hiện.
 * - Khung / nút đổi kích thước (xoay màn hình, số trên nút đổi…) → bám theo từng khung hình, không trượt.
 * - Không có mục nào đang chọn → ẩn.
 * Chỉnh thẳng style (không qua state) nên không render lại.
 */
export function useSlidingIndicator(
  wrapRef: RefObject<HTMLElement | null>,
  indicatorRef: RefObject<HTMLElement | null>,
  activeSelector: string,
  activeKey: unknown,
  itemsKey: string,
  mode: "box" | "underline" = "box",
) {
  const visible = useRef(false);

  const place = (animate: boolean) => {
    const wrap = wrapRef.current;
    const ind = indicatorRef.current;
    if (!wrap || !ind) return;
    const el = wrap.querySelector<HTMLElement>(activeSelector);
    if (!el) {
      ind.style.opacity = "0";
      visible.current = false;
      return;
    }
    const slide = animate && visible.current;
    ind.style.transition = slide ? "" : "none";
    ind.style.width = `${el.offsetWidth}px`;
    if (mode === "box") ind.style.height = `${el.offsetHeight}px`;
    ind.style.transform = `translate(${el.offsetLeft}px, ${mode === "box" ? el.offsetTop : 0}px)`;
    if (!slide) void ind.offsetWidth; // áp vị trí mới trước khi bật lại transition
    ind.style.opacity = "1";
    visible.current = true;
  };
  const placeRef = useRef(place);
  useLayoutEffect(() => {
    placeRef.current = place;
  });

  useLayoutEffect(() => {
    placeRef.current(true);
  }, [activeKey]);

  // ResizeObserver gọi ngay khi bắt đầu theo dõi → chỉ tạo lại khi danh sách mục đổi (không phải khi đổi mục chọn)
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => placeRef.current(false));
    ro.observe(wrap);
    // theo dõi khung và từng mục — trừ chính thanh trượt (nó đổi kích thước khi trượt, theo dõi sẽ cắt mất hiệu ứng)
    for (const child of wrap.children) if (child !== indicatorRef.current) ro.observe(child);
    return () => ro.disconnect();
  }, [itemsKey, wrapRef, indicatorRef]);
}

export interface SegmentedItem<K> {
  key: K;
  label: ReactNode;
  count?: number;
  title?: string;
}

export default function SegmentedTabs<K extends string | number>({
  label,
  items,
  value,
  onChange,
  size = "md",
  variant = "pill",
  stretch = false,
  className = "",
}: {
  /** tên nhóm cho trình đọc màn hình */
  label: string;
  items: SegmentedItem<K>[];
  /** null = chưa chọn mục nào */
  value: K | null;
  onChange: (k: K) => void;
  size?: "md" | "sm";
  /** pill: nhóm nút liền khối, nền xanh trượt; underline: tab gạch chân, vạch xanh trượt */
  variant?: "pill" | "underline";
  /** giãn hết bề ngang, các nút chia đều */
  stretch?: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  useSlidingIndicator(
    wrapRef,
    indRef,
    "[aria-selected=true]",
    value,
    items.map((it) => it.key).join("|"),
    variant === "underline" ? "underline" : "box",
  );

  const underline = variant === "underline";
  const sm = size === "sm";
  const wrapCls = underline
    ? "relative flex gap-1 border-b border-line"
    : `relative flex max-w-full gap-1 overflow-x-auto border border-line bg-surface ${sm ? "rounded-xl p-0.5" : "rounded-2xl p-1"}`;
  const indCls = underline
    ? "pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-primary"
    : `pointer-events-none absolute top-0 left-0 bg-primary shadow-sm ${sm ? "rounded-[10px]" : "rounded-xl"}`;
  const btnCls = (on: boolean) =>
    underline
      ? `relative -mb-px px-3 font-semibold transition-colors duration-300 ${sm ? "py-1 text-sm" : "py-2"} ${on ? "text-fg" : "text-muted hover:text-fg"}`
      : `relative rounded-xl font-medium whitespace-nowrap transition-colors duration-300 ${sm ? "px-3 py-1 text-sm" : "px-4 py-1.5 text-sm"} ${
          on ? "text-on-primary" : "text-muted hover:text-fg"
        }`;

  return (
    <div
      ref={wrapRef}
      role="tablist"
      aria-label={label}
      className={`${wrapCls} ${stretch ? "w-full" : "w-fit"} ${className}`}
    >
      {/* đặt trước các nút: cùng là phần tử định vị nên vẽ theo thứ tự — nút vẽ sau, nằm trên nền */}
      <span
        ref={indRef}
        aria-hidden
        className={`${indCls} opacity-0 transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none`}
      />
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={value === it.key}
          title={it.title}
          onClick={() => onChange(it.key)}
          className={`${btnCls(value === it.key)} ${stretch ? "flex-1" : "shrink-0"}`}
        >
          <SmoothWidth>
            {it.label}
            {it.count != null && <span className="ml-1.5 text-xs opacity-70">{it.count.toLocaleString("vi-VN")}</span>}
          </SmoothWidth>
        </button>
      ))}
    </div>
  );
}
