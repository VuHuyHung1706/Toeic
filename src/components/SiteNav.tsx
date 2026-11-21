"use client";
// Menu chính: mỗi mục một icon có màu riêng; mục đang mở hiện dạng viên thuốc (nền xanh nhạt, chữ xanh).
// Điện thoại: hàng cuộn ngang, nhãn ngắn.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon, SECTIONS } from "./SectionIcons";

export default function SiteNav() {
  const pathname = usePathname() ?? "";
  const rowRef = useRef<HTMLDivElement>(null);
  // điện thoại (hàng cuộn ngang): cuộn để mục đang mở nằm giữa hàng — chỉ cuộn hàng menu, không cuộn trang
  useEffect(() => {
    const row = rowRef.current;
    const cur = row?.querySelector<HTMLElement>("[aria-current=page]");
    if (!row || !cur || row.scrollWidth <= row.clientWidth) return;
    const offset = cur.getBoundingClientRect().left - row.getBoundingClientRect().left;
    row.scrollTo({ left: row.scrollLeft + offset - row.clientWidth / 2 + cur.offsetWidth / 2, behavior: "smooth" });
  }, [pathname]);
  return (
    <div
      ref={rowRef}
      className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-1 overflow-x-auto px-4 pb-1 text-[13px] whitespace-nowrap sm:mx-0 sm:w-auto sm:px-0 sm:pb-0 sm:text-sm"
    >
      {SECTIONS.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`group flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
              active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            <Icon
              name={it.icon}
              className={`size-[18px] transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none ${
                active ? "text-primary" : it.color
              }`}
            />
            <span className="sm:hidden">{it.short}</span>
            <span className="hidden sm:inline">{it.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
