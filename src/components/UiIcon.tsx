// Bộ icon giao diện dùng chung (nút, nhãn, điều khiển): cùng kiểu nét với icon menu (SectionIcons) —
// nét 2, đầu tròn, khung 24×24, cỡ mặc định 18px. Không dùng ký tự / emoji (← ✕ ☆ 🎧…) làm icon nữa.
import type { ReactNode } from "react";

const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const STAR = "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z";

const PATHS = {
  arrowLeft: <path {...s} d="M19 12H5m6-6-6 6 6 6" />,
  arrowRight: <path {...s} d="M5 12h14m-6-6 6 6-6 6" />,
  chevronLeft: <path {...s} d="m15 18-6-6 6-6" />,
  chevronRight: <path {...s} d="m9 18 6-6-6-6" />,
  chevronDown: <path {...s} d="m6 9 6 6 6-6" />,
  close: <path {...s} d="M6 6l12 12M18 6 6 18" />,
  check: <path {...s} d="m5 12 5 5L20 7" />,
  star: <path {...s} d={STAR} />,
  starFilled: <path d={STAR} fill="currentColor" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />,
  /** học lại từ đầu */
  reset: <path {...s} d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />,
  /** đổi / làm mới */
  refresh: <path {...s} d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />,
  external: <path {...s} d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  headphones: (
    <path
      {...s}
      d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1v-5zm16 0h-2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-5z"
    />
  ),
  book: <path {...s} d="M12 7a4 4 0 0 0-4-3H3v15h6a3 3 0 0 1 3 3m0-15a4 4 0 0 1 4-3h5v15h-6a3 3 0 0 0-3 3m0-15v15" />,
  chat: <path {...s} d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  sound: <path {...s} d="M11 5 6 9H3v6h3l5 4V5zm4.5 3.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />,
  search: (
    <>
      <circle {...s} cx="11" cy="11" r="7" />
      <path {...s} d="m20 20-3.5-3.5" />
    </>
  ),
  bulb: <path {...s} d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z" />,
  play: <path d="M8 5v14l11-7z" fill="currentColor" />,
  pause: <path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor" />,
  shuffle: <path {...s} d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />,
  gear: (
    <>
      <circle {...s} cx="12" cy="12" r="3" />
      <path
        {...s}
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
      />
    </>
  ),
  lock: (
    <>
      <rect {...s} x="5" y="11" width="14" height="10" rx="2" />
      <path {...s} d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  logout: <path {...s} d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />,
  /** danh sách câu hỏi (lưới ô) */
  grid: <path {...s} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  expand: <path {...s} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path {...s} d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
} satisfies Record<string, ReactNode>;

export type UiIconName = keyof typeof PATHS;

export default function UiIcon({ name, className = "size-[18px]" }: { name: UiIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`shrink-0 ${className}`}>
      {PATHS[name]}
    </svg>
  );
}
