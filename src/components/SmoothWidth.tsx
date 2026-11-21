"use client";
// Bọc phần chữ có thể đổi độ dài trong nút (vd "Câu 9/30" → "Câu 10/30", "20 mới" → "100 mới"):
// bề rộng chuyển dần sang kích thước mới thay vì nút bật to/nhỏ ngay lập tức.
// Đo bề rộng tự nhiên của nội dung bằng ResizeObserver rồi đặt cho khung ngoài (có transition).
import { useLayoutEffect, useRef, type ReactNode } from "react";

export default function SmoothWidth({ children, className = "" }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const ro = new ResizeObserver(() => {
      o.style.width = `${i.offsetWidth}px`;
    });
    ro.observe(i);
    return () => ro.disconnect();
  }, []);

  return (
    <span
      ref={outer}
      className={`inline-block overflow-hidden align-bottom whitespace-nowrap transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${className}`}
    >
      <span ref={inner} className="inline-block tabular-nums">
        {children}
      </span>
    </span>
  );
}
