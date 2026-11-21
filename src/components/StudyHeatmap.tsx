import { DAY } from "@/lib/activity";
import { dayKey } from "@/lib/storage";

// Lịch học (heatmap): tuần theo cột, thứ theo hàng, ô càng đậm ngày đó học càng nhiều.
// Dùng ở trang Tiến độ và khối "Hôm nay" ở trang chủ.
export default function StudyHeatmap({
  activity,
  today,
  weeks = 16,
  fluid = false,
}: {
  activity: Map<string, number>;
  /** đầu ngày hôm nay (startOfDay) */
  today: number;
  weeks?: number;
  /** ô tự giãn theo bề rộng khung (tối đa ~32rem) thay vì cố định 12px */
  fluid?: boolean;
}) {
  // cột cuối là tuần hiện tại, hàng 0 = thứ Hai
  const dow = (new Date(today).getDay() + 6) % 7;
  const start = today - (dow + (weeks - 1) * 7) * DAY;
  const days = Array.from({ length: weeks * 7 }, (_, i) => start + i * DAY);
  const max = Math.max(1, ...days.map((d) => activity.get(dayKey(d)) ?? 0));
  const level = (n: number) => (n <= 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const shade = ["var(--surface-2)", "25%", "50%", "75%", "100%"];
  const fill = (l: number) => (l === 0 ? shade[0] : `color-mix(in oklab, var(--primary) ${shade[l]}, var(--surface))`);
  const total = days.reduce((s, d) => s + (activity.get(dayKey(d)) ?? 0), 0);
  const labels = ["T2", "", "T4", "", "T6", "", "CN"];
  const cell = (d: number, className: string) => {
    const n = activity.get(dayKey(d)) ?? 0;
    const label = `${new Date(d).toLocaleDateString("vi-VN")}: ${n} câu`;
    return (
      <div
        key={d}
        title={label}
        aria-label={label}
        className={`rounded-[3px] ${className}`}
        style={{ background: d > today ? "transparent" : fill(level(n)) }}
      />
    );
  };

  return (
    <div className={`mt-4 ${fluid ? "max-w-lg" : ""}`}>
      {fluid ? (
        // một lưới: cột đầu là tên thứ, mỗi cột sau là một tuần; ô vuông giãn theo bề rộng
        <div
          className="grid items-center gap-[3px] text-[10px] leading-none text-muted"
          style={{ gridTemplateColumns: `auto repeat(${weeks}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column" }}
        >
          {labels.map((d, i) => (
            <span key={`l${i}`} className="pr-1.5">
              {d}
            </span>
          ))}
          {days.map((d) => cell(d, "aspect-square w-full"))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-0 text-[10px] leading-3 text-muted">
            {labels.map((d, i) => (
              <span key={i} className="h-3">
                {d}
              </span>
            ))}
          </div>
          <div className="grid shrink-0 grid-flow-col grid-rows-7 gap-[3px]">{days.map((d) => cell(d, "size-3"))}</div>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span>{total.toLocaleString("vi-VN")} câu trong {weeks} tuần</span>
        <span className="ml-auto">Ít</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-3 rounded-[3px]" style={{ background: fill(l) }} />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  );
}
