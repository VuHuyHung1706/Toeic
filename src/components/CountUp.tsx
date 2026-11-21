"use client";
// Số chạy từ 0 lên giá trị thật (chậm dần ở cuối). Người dùng bật "giảm chuyển động" thì hiện luôn số cuối.
// Trình đọc màn hình chỉ đọc giá trị cuối.
import { useEffect, useState } from "react";

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function CountUp({ value, duration = 900, delay = 0 }: { value: number; duration?: number; delay?: number }) {
  const [shown, setShown] = useState(() => (reduceMotion() ? value : 0));

  useEffect(() => {
    const dur = reduceMotion() ? 0 : duration;
    let raf = 0;
    const t0 = performance.now() + (dur ? delay : 0);
    const tick = (now: number) => {
      const k = dur ? Math.min(1, Math.max(0, (now - t0) / dur)) : 1;
      setShown(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);

  return (
    <>
      <span aria-hidden className="tabular-nums">
        {shown}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
