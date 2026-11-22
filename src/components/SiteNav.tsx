"use client";
// Menu chính: mỗi mục một icon có màu riêng; mục đang mở hiện dạng viên thuốc (nền xanh nhạt, chữ xanh).
// Không đủ chỗ (cửa sổ hẹp / điện thoại): hiện các mục vừa hàng, phần còn lại gom vào nút mũi tên xuống ở cuối
// (mục đang mở luôn được giữ trên hàng). Bề rộng từng mục đo từ một hàng ẩn có đủ mọi mục.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSlidingIndicator } from "./SegmentedTabs";
import { Icon, SECTIONS } from "./SectionIcons";
import UiIcon from "./UiIcon";

const GAP = 4; // gap-1

const itemClass = "group relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors duration-300";

function ItemBody({ it, active }: { it: (typeof SECTIONS)[number]; active: boolean }) {
  return (
    <>
      <Icon
        name={it.icon}
        className={`size-[18px] transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none ${
          active ? "text-primary" : it.color
        }`}
      />
      <span className="sm:hidden">{it.short}</span>
      <span className="hidden sm:inline">{it.label}</span>
    </>
  );
}

const Chevron = ({ open }: { open: boolean }) => (
  <UiIcon name="chevronDown" className={`size-[18px] transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
);

export default function SiteNav() {
  const pathname = usePathname() ?? "";
  const rowRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeIdx = SECTIONS.findIndex((it) => pathname === it.href || pathname.startsWith(`${it.href}/`));
  const activeHref = activeIdx >= 0 ? SECTIONS[activeIdx].href : null;

  // các mục hiện trên hàng (chỉ số trong SECTIONS); ban đầu (server) hiện đủ
  const [shown, setShown] = useState<number[]>(() => SECTIONS.map((_, i) => i));
  const [open, setOpen] = useState(false);
  const hidden = SECTIONS.map((_, i) => i).filter((i) => !shown.includes(i));

  // đo và chia mục: vừa hết thì hiện hết; không thì giữ mục đang mở + các mục đầu, chừa chỗ cho nút "thêm"
  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const fit = () => {
      const cs = getComputedStyle(row);
      const avail = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const els = [...measure.children] as HTMLElement[];
      const widths = els.slice(0, SECTIONS.length).map((el) => el.getBoundingClientRect().width);
      const moreW = els[SECTIONS.length]?.getBoundingClientRect().width ?? 36;
      const total = widths.reduce((a, b) => a + b, 0) + GAP * (widths.length - 1);
      let next: number[];
      if (total <= avail + 0.5) next = SECTIONS.map((_, i) => i);
      else {
        const keep = new Set<number>(activeIdx >= 0 ? [activeIdx] : []);
        let used = activeIdx >= 0 ? widths[activeIdx] : 0;
        for (let i = 0; i < widths.length; i++) {
          if (keep.has(i)) continue;
          const add = widths[i] + (keep.size ? GAP : 0);
          if (used + add + GAP + moreW > avail) break;
          keep.add(i);
          used += add;
        }
        next = [...keep].sort((a, b) => a - b);
      }
      setShown((cur) => (cur.join() === next.join() ? cur : next));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    ro.observe(measure); // đổi cỡ chữ / font tải xong
    return () => ro.disconnect();
  }, [activeIdx]);

  // nền xanh nhạt của mục đang mở trượt sang mục mới khi chuyển trang (trang chủ: không mục nào → ẩn)
  useSlidingIndicator(rowRef, pillRef, "[aria-current=page]", activeHref, shown.join(), "box");

  // bấm ra ngoài / Esc → đóng danh sách
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rowRef}
      className="relative -mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-1 px-4 pb-1 text-[13px] whitespace-nowrap sm:mx-0 sm:w-auto sm:flex-1 sm:px-0 sm:pb-0 sm:text-sm"
    >
      {/* hàng đo: đủ mọi mục + nút "thêm", ẩn và bị cắt (không làm trang cuộn ngang) */}
      <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
        <div ref={measureRef} className="flex w-max gap-1">
          {SECTIONS.map((it) => (
            <span key={it.href} className={itemClass}>
              <ItemBody it={it} active={false} />
            </span>
          ))}
          <span className={`${itemClass} px-2`}>
            <Chevron open={false} />
          </span>
        </div>
      </div>

      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 rounded-lg bg-primary-soft opacity-0 transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      />
      {shown.map((i) => {
        const it = SECTIONS[i];
        const active = it.href === activeHref;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`${itemClass} ${active ? "text-primary" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
          >
            <ItemBody it={it} active={active} />
          </Link>
        );
      })}

      {hidden.length > 0 && (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`Thêm ${hidden.length} mục`}
            title="Các mục khác"
            className={`${itemClass} px-2 ${open ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
          >
            <Chevron open={open} />
          </button>
          {open && (
            <div
              role="menu"
              className="step-fade absolute top-full right-0 z-40 mt-2 w-52 rounded-2xl border border-line bg-surface p-1.5 text-sm shadow-xl"
            >
              {hidden.map((i) => {
                const it = SECTIONS[i];
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <Icon name={it.icon} className={`size-[18px] ${it.color}`} />
                    {it.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
