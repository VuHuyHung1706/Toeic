// Script Part 3/4 (xem tiếng Anh hoặc tiếng Việt): mỗi lượt lời một dòng, nhãn người nói giữ nguyên chữ và tô màu.
// Bản tiếng Việt: màu theo người nói ở dòng tiếng Anh tương ứng (khi số dòng khớp) để hai bản cùng màu;
// dòng tiếng Việt không ghi nhãn thì mượn nhãn của dòng tiếng Anh.
import type { ReactNode } from "react";
import SpeakerBadge from "./SpeakerBadge";
import { speakerTones, splitSpeaker } from "@/lib/speaker";

export default function ScriptLines({
  text,
  en,
  render = (s) => s,
}: {
  text: string;
  /** bản tiếng Anh tương ứng (khi đang xem bản dịch) */
  en?: string;
  render?: (s: string) => ReactNode;
}) {
  const lines = text.split("\n");
  const enLines = en?.split("\n");
  const paired = enLines && enLines.length === lines.length ? enLines : null;
  const toneOf = speakerTones(paired ?? lines);
  return (
    <div className="space-y-1.5 text-[15px] leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        const own = splitSpeaker(line);
        const ref = paired ? splitSpeaker(paired[i]) : own;
        const shown = own ?? ref;
        const rest = own ? own.rest : line.replace(/\*\*/g, "");
        return (
          <p key={i}>
            {shown && <SpeakerBadge speaker={shown.speaker} tone={toneOf((ref ?? shown).speaker)} />}
            {render(rest)}
          </p>
        );
      })}
    </div>
  );
}
