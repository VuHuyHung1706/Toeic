"use client";
// Hiệu ứng chuyển câu: đổi `index` → nội dung mới trượt nhẹ + hiện dần
// (đi tới: từ phải sang; lùi lại: từ trái sang). Lần hiển thị đầu không có hiệu ứng.
// Lớp CSS .step-enter-next / .step-enter-prev trong globals.css (tắt khi máy bật "giảm chuyển động").

import { useState, type ReactNode } from "react";

export default function StepTransition({ index, className = "", children }: { index: number; className?: string; children: ReactNode }) {
  const [prev, setPrev] = useState(index);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  // cập nhật hướng ngay trong lúc render khi index đổi (mẫu "điều chỉnh state theo prop" của React)
  if (index !== prev) {
    setPrev(index);
    setDir(index > prev ? 1 : -1);
  }
  const anim = dir === 1 ? "step-enter-next" : dir === -1 ? "step-enter-prev" : "";
  return (
    <div key={index} className={`${anim} ${className}`}>
      {children}
    </div>
  );
}
