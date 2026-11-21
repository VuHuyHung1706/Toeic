// Các mục chính của web: đường dẫn, tên, màu và icon riêng — dùng chung cho menu (SiteNav) và trang chủ.
import type { ReactNode } from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS = {
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
  // ngữ pháp: chữ "Aa"
  grammar: (
    <>
      <path {...stroke} d="M3 19L8 5l5 14M4.8 14.5h6.4" />
      <circle {...stroke} cx="17.5" cy="15.5" r="3.5" />
      <path {...stroke} d="M21 12v7" />
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
  // chuỗi ngày học: ngọn lửa
  streak: (
    <path
      {...stroke}
      d="M12 22c4 0 7-2.7 7-6.8 0-3.4-2.2-5.7-3.6-7.2-.3 1.8-1.2 3-2.4 3.6.2-3.1-1.2-6.3-4-8.6-.1 3.3-1.7 5.2-3.2 7C4.6 11.4 5 13 5 15.2 5 19.3 8 22 12 22z"
    />
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`shrink-0 ${className}`}>
      {ICONS[name]}
    </svg>
  );
}

export interface Section {
  href: string;
  icon: IconName;
  label: string;
  /** nhãn ngắn trên menu điện thoại */
  short: string;
  /** màu icon */
  color: string;
  /** nền nhạt cùng màu (ô icon ở trang chủ) */
  tint: string;
}

export const SECTIONS: Section[] = [
  { href: "/tests", icon: "tests", label: "Đề thi", short: "Đề thi", color: "text-orange-500 dark:text-orange-400", tint: "bg-orange-500/10" },
  { href: "/practice", icon: "practice", label: "Luyện dạng", short: "Dạng câu", color: "text-violet-500 dark:text-violet-400", tint: "bg-violet-500/10" },
  { href: "/grammar", icon: "grammar", label: "Ngữ pháp", short: "Ngữ pháp", color: "text-amber-500 dark:text-amber-400", tint: "bg-amber-500/10" },
  { href: "/listening", icon: "listening", label: "Luyện nghe", short: "Nghe", color: "text-sky-500 dark:text-sky-400", tint: "bg-sky-500/10" },
  { href: "/vocabulary", icon: "vocabulary", label: "Từ vựng", short: "Từ vựng", color: "text-emerald-500 dark:text-emerald-400", tint: "bg-emerald-500/10" },
  { href: "/mistakes", icon: "mistakes", label: "Sổ câu sai", short: "Câu sai", color: "text-rose-500 dark:text-rose-400", tint: "bg-rose-500/10" },
  { href: "/history", icon: "history", label: "Tiến độ", short: "Tiến độ", color: "text-teal-500 dark:text-teal-400", tint: "bg-teal-500/10" },
];

export const sectionOf = (href: string) => SECTIONS.find((s) => s.href === href)!;
