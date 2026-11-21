// Icon cho các nút bắt đầu làm bài: đồng hồ bấm giờ (Thi thử) và cây bút (Luyện tập).
// Nét vẽ cùng kiểu với icon menu (SiteNav); hơi nghiêng khi rê chuột vào nút có class "group".

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const base = "size-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none";

/** Đồng hồ bấm giờ */
export function ExamIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${base} ${className}`}>
      <circle {...stroke} cx="12" cy="13.5" r="7.5" />
      <path {...stroke} d="M12 9.5v4l2.5 2M10 2.5h4M12 2.5V6M18.5 6.5l1.5-1.5" />
    </svg>
  );
}

/** Cây bút chì */
export function PracticeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${base} ${className}`}>
      <path {...stroke} d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
      <path {...stroke} d="M14.5 5.5l3 3M13 20h7" />
    </svg>
  );
}
