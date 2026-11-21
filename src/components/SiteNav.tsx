"use client";
// Menu chính: mỗi mục một icon có màu riêng; mục đang mở hiện dạng viên thuốc (nền xanh nhạt, chữ xanh).
// Điện thoại: hàng cuộn ngang, nhãn ngắn.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<string, ReactNode> = {
  // đề thi: tờ giấy có dòng chữ
  tests: (
    <>
      <path {...stroke} d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path {...stroke} d="M14 3v5h5M9 13h6M9 17h6M9 9h1" />
    </>
  ),
  // luyện dạng: bia ngắm
  practice: (
    <>
      <circle {...stroke} cx="12" cy="12" r="9" />
      <circle {...stroke} cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
  // luyện nghe: tai nghe
  listening: (
    <path
      {...stroke}
      d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1v-5zm16 0h-2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-5z"
    />
  ),
  // từ vựng: quyển sách có chữ A
  vocabulary: (
    <>
      <path {...stroke} d="M4 19V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h14" />
      <path {...stroke} d="M9.5 14l2.5-7 2.5 7M10.3 11.8h3.4" />
    </>
  ),
  // sổ câu sai: dấu trang có dấu ×
  mistakes: <path {...stroke} d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1zm4 5l4 4m0-4l-4 4" />,
  // tiến độ: biểu đồ đi lên
  history: <path {...stroke} d="M3 3v18h18M7 15l4-4 3 3 6-6M15 8h5v5" />,
};

const ITEMS: { href: string; key: keyof typeof ICONS; label: string; short: string; color: string }[] = [
  { href: "/tests", key: "tests", label: "Đề thi", short: "Đề thi", color: "text-orange-500 dark:text-orange-400" },
  { href: "/practice", key: "practice", label: "Luyện dạng", short: "Dạng câu", color: "text-violet-500 dark:text-violet-400" },
  { href: "/listening", key: "listening", label: "Luyện nghe", short: "Nghe", color: "text-sky-500 dark:text-sky-400" },
  { href: "/vocabulary", key: "vocabulary", label: "Từ vựng", short: "Từ vựng", color: "text-emerald-500 dark:text-emerald-400" },
  { href: "/mistakes", key: "mistakes", label: "Sổ câu sai", short: "Câu sai", color: "text-rose-500 dark:text-rose-400" },
  { href: "/history", key: "history", label: "Tiến độ", short: "Tiến độ", color: "text-teal-500 dark:text-teal-400" },
];

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
      {ITEMS.map((it) => {
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
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className={`size-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none ${
                active ? "text-primary" : it.color
              }`}
            >
              {ICONS[it.key]}
            </svg>
            <span className="sm:hidden">{it.short}</span>
            <span className="hidden sm:inline">{it.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
