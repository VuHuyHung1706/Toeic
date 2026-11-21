// Logo ĐMToeic: biểu tượng (ô vuông xanh → navy, chữ "Đm" trắng, gạch cam bên dưới) + chữ "ĐMToeic".
// Biểu tượng vẽ bằng path (không dùng phông) để rõ nét cả ở cỡ favicon; cùng hình với src/app/icon.svg.

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="dm-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f62e8" />
          <stop offset="1" stopColor="#0b2447" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#dm-logo-bg)" />
      {/* chữ "Đm": Đ hoa (thân + vòm khoét rỗng + gạch ngang) và m thường cùng chân chữ */}
      <path fill="#fff" fillRule="evenodd" d="M10 17h8.6C25.7 17 31 22.8 31 31.5S25.7 46 18.6 46H10V17Z M15.8 22.6v17.8h2.6c3.9 0 6.8-3.6 6.8-8.9s-2.9-8.9-6.8-8.9h-2.6Z" />
      <rect x="6" y="29" width="11.5" height="5" rx="1.5" fill="#fff" />
      <path d="M35.5 46V30M35.5 34.6c0-2.9 2-4.6 4.6-4.6s4.6 1.7 4.6 4.6V46M44.7 34.6c0-2.9 2-4.6 4.6-4.6s4.6 1.7 4.6 4.6V46" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
      {/* gạch cam bên dưới: điểm nhấn cùng màu nút Submit */}
      <rect x="10" y="50.5" width="44" height="4.5" rx="2.25" fill="#f7941d" />
    </svg>
  );
}

/** Biểu tượng + chữ. onDark: dùng trên nền tối/navy (chữ trắng) */
export default function Logo({ onDark = false, className = "" }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 leading-none ${className}`}>
      {/* nền tối/navy: viền sáng mảnh để ô vuông không hoà vào nền */}
      <LogoMark className={`size-8 shrink-0 ${onDark ? "rounded-[23%] ring-1 ring-white/40" : ""}`} />
      <span className={`text-lg font-extrabold tracking-tight ${onDark ? "text-white" : "text-fg"}`}>
        ĐM<span className={onDark ? "text-[#8fb0ff]" : "text-primary"}>Toeic</span>
      </span>
    </span>
  );
}
