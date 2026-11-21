// Vòng tròn tiến độ cho khối "Hôm nay" ở trang chủ.
// - ProgressRing: một vòng tô theo tỉ lệ (vd điểm dự đoán / 990), tô dần khi hiện.
// - WeekRing: vòng 7 đoạn, mỗi đoạn là một ngày (7 ngày gần nhất, đoạn trên cùng là 6 ngày trước, đi theo chiều kim đồng hồ tới hôm nay).
import type { ReactNode } from "react";

const SIZE = 128;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const MID = SIZE / 2;

function Frame({ label, children, center }: { label: string; children: ReactNode; center: ReactNode }) {
  return (
    <div className="relative size-36 shrink-0" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full" aria-hidden>
        {children}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" aria-hidden>
        <div>{center}</div>
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  color,
  label,
  children,
}: {
  /** 0–1 */
  value: number;
  /** class màu nét, vd "stroke-teal-500 dark:stroke-teal-400" */
  color: string;
  label: string;
  children: ReactNode;
}) {
  const p = Math.min(1, Math.max(0, value));
  return (
    <Frame label={label} center={children}>
      <circle cx={MID} cy={MID} r={R} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
      {p > 0 && (
        <circle
          cx={MID}
          cy={MID}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p)}
          transform={`rotate(-90 ${MID} ${MID})`}
          className={`ring-fill ${color}`}
          style={{ ["--ring-c" as string]: `${C}` }}
        />
      )}
    </Frame>
  );
}

export function WeekRing({
  days,
  color,
  label,
  children,
}: {
  /** 7 ngày, cũ → mới (hôm nay cuối cùng): true = có học */
  days: boolean[];
  /** class màu nét của ngày có học */
  color: string;
  label: string;
  children: ReactNode;
}) {
  const n = days.length;
  const gap = 20; // độ giữa hai đoạn (đầu nét tròn ăn bớt khoảng ~10°)
  const seg = (C * (360 / n - gap)) / 360;
  return (
    <Frame label={label} center={children}>
      {days.map((on, i) => (
        <circle
          key={i}
          cx={MID}
          cy={MID}
          r={R}
          fill="none"
          stroke="var(--line)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${seg} ${C}`}
          transform={`rotate(${-90 + (i * 360) / n + gap / 2} ${MID} ${MID})`}
          className={on ? `ring-seg ${color}` : undefined}
          style={on ? { animationDelay: `${i * 70}ms` } : undefined}
        />
      ))}
    </Frame>
  );
}
