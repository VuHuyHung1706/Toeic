"use client";
// Thanh phân trang: ‹ 1 … 4 5 6 … 49 › — luôn có trang đầu, trang cuối và hai trang quanh trang đang xem.
import UiIcon from "./UiIcon";

/** Các ô số trang cần hiện; "…" là khoảng bị lược */
export function pageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, total, current - 1, current, current + 1]);
  // gần đầu / cuối: hiện liền 5 trang để thanh không bị co giật khi chuyển trang
  if (current <= 4) [2, 3, 4, 5].forEach((p) => keep.add(p));
  if (current >= total - 3) [total - 4, total - 3, total - 2, total - 1].forEach((p) => keep.add(p));
  const pages = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(p - pages[i - 1] === 2 ? p - 1 : "…");
    out.push(p);
  });
  return out;
}

const btn = "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-medium tabular-nums transition";

export default function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  const arrow = (to: number, label: string, icon: "chevronLeft" | "chevronRight") => (
    <button
      onClick={() => onChange(to)}
      disabled={to < 1 || to > total}
      aria-label={label}
      className={`${btn} text-muted hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-35`}
    >
      <UiIcon name={icon} className="size-4" />
    </button>
  );
  return (
    <nav aria-label="Phân trang" className="mt-5 flex flex-wrap items-center justify-center gap-1">
      {arrow(page - 1, "Trang trước", "chevronLeft")}
      {pageItems(page, total).map((p, i) =>
        p === "…" ? (
          <span key={`gap${i}`} className="grid h-9 w-6 place-items-center text-sm text-muted" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Trang ${p}`}
            className={`${btn} ${p === page ? "bg-primary text-on-primary" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
          >
            {p}
          </button>
        ),
      )}
      {arrow(page + 1, "Trang sau", "chevronRight")}
    </nav>
  );
}
