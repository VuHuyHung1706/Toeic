// Nhãn người nói trong script Part 3/4: giữ nguyên chữ như trong đề, tô màu theo người
// (nam tông xanh, nữ tông hồng/cam, không rõ giới tông tím/xanh lá; người khác cùng giới đổi tông).
import { ACCENTS, type Speaker } from "@/lib/speaker";

const TONES: Record<string, string> = {
  M1: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  M2: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  M3: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  W1: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  W2: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  W3: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  X1: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  X2: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export default function SpeakerBadge({ speaker, tone }: { speaker: Speaker; tone: string }) {
  const who = speaker.gender === "M" ? "Nam" : speaker.gender === "W" ? "Nữ" : "Người nói";
  const accent = speaker.accent ? ACCENTS[speaker.accent] : null;
  return (
    <span
      title={`${who}${accent ? ` · giọng ${accent}` : ""}`}
      className={`mr-1.5 inline-block rounded-md px-1.5 py-px align-[1px] text-xs font-bold whitespace-nowrap ${TONES[tone] ?? TONES.X1}`}
    >
      {speaker.label}
    </span>
  );
}
