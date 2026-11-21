"use client";

import { useMemo, type ReactNode } from "react";
import SpeakerBadge from "./SpeakerBadge";
import { alignBilingual } from "@/lib/bilingual";
import { speakerTones, splitSpeaker } from "@/lib/speaker";

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
  // màu người nói tính theo cả đoạn hội thoại tiếng Anh (nhãn giữ nguyên chữ như trong đề)
  const toneOf = useMemo(() => speakerTones(en.split("\n")), [en]);
  return (
    <div className="text-[15px] leading-relaxed">
      {pairs.map((p, i) => {
        // nhãn người nói ở đầu lượt lời (bản dịch bỏ nhãn, dùng chung nhãn của câu tiếng Anh)
        const who = splitSpeaker(p.en);
        const enText = who ? who.rest : p.en.replace(/\*\*/g, "");
        const vs = splitSpeaker(p.vi);
        const viText = vs ? vs.rest : p.vi.replace(/\*\*/g, "").replace(/^["“]\s*/, "");
        return (
          <div key={i} className={i === 0 ? "" : p.newParagraph ? "mt-4" : "mt-2"}>
            {p.en && (
              <p>
                {who && <SpeakerBadge speaker={who.speaker} tone={toneOf(who.speaker)} />}
                {renderText(enText, "en")}
              </p>
            )}
            {/* bản dịch giống hệt bản gốc (tên riêng, địa chỉ, số) thì không lặp lại */}
            {viText && viText.trim() !== enText.trim() && <p className="text-vi">{renderText(viText, "vi", enText)}</p>}
          </div>
        );
      })}
    </div>
  );
}
