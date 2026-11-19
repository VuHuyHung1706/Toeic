"use client";

import { useMemo, type ReactNode } from "react";
import { alignBilingual } from "@/lib/bilingual";

// Nhãn người nói ở đầu lượt lời: "W-Am:", "M-Cn", "Man:", "W" …
// (chấp nhận cả mã vùng gõ sai trong dữ liệu như "M-Al")
const SPEAKER_RE = /^((?:[WMwm]-[A-Za-z]{2})|(?:Man|Woman)\s*\d?|[WM]\d?)\s*:?\s+/;

/** Song ngữ: mỗi câu tiếng Anh gốc ở trên, bản dịch tiếng Việt màu xanh ngay bên dưới */
export default function BilingualText({
  en,
  vi,
  renderText = (s: string) => s,
}: {
  en: string;
  vi: string;
  /** Tuỳ biến cách hiển thị từng câu (vd. điền đáp án vào chỗ trống Part 6) */
  renderText?: (s: string, lang: "en" | "vi", pairEn?: string) => ReactNode;
}) {
  const pairs = useMemo(() => alignBilingual(en, vi), [en, vi]);
  return (
    <div className="text-[15px] leading-relaxed">
      {pairs.map((p, i) => {
        const m = p.en.match(SPEAKER_RE);
        const label = m?.[1];
        const enText = label ? p.en.slice(m![0].length) : p.en;
        const vm = label ? p.vi.match(SPEAKER_RE) : null;
        const viText = vm ? p.vi.slice(vm[0].length) : p.vi;
        return (
          <div key={i} className={i === 0 ? "" : p.newParagraph ? "mt-4" : "mt-2"}>
            {p.en && (
              <p>
                {label && <b className="mr-1.5">{label}:</b>}
                {renderText(enText, "en")}
              </p>
            )}
            {/* bản dịch giống hệt bản gốc (tên riêng, địa chỉ, số) thì không lặp lại */}
            {viText && viText.trim() !== enText.trim() && <p className="text-primary">{renderText(viText, "vi", enText)}</p>}
          </div>
        );
      })}
    </div>
  );
}
