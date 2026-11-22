// Nhãn có icon đứng trước (tab "Nghe" / "Đọc", nguồn câu ví dụ…)
import type { ReactNode } from "react";
import UiIcon, { type UiIconName } from "./UiIcon";

export default function IconLabel({ icon, children, size = "size-4" }: { icon: UiIconName; children: ReactNode; size?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <UiIcon name={icon} className={size} />
      {children}
    </span>
  );
}
