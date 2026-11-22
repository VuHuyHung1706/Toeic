"use client";
// Khối "Hôm nay" ở trang chủ: lịch học 16 tuần, chuỗi ngày học, điểm dự đoán.
// Đọc dữ liệu học trên trình duyệt → chỉ render ở client (bọc trong ClientOnly ở trang chủ).
// Người mới (chưa có dữ liệu gì) không thấy khối này.
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import CountUp from "./CountUp";
import { Icon, sectionOf } from "./SectionIcons";
import { ProgressRing, WeekRing } from "./Rings";
import StudyHeatmap from "./StudyHeatmap";
import { DAY, buildActivity, startOfDay, streakOf } from "@/lib/activity";
import { dayKey, useAttempts, useDictation, useReviews, useVocabLog } from "@/lib/storage";
import { predictScore } from "@/lib/toeic";

export default function HomeToday() {
  const attempts = useAttempts();
  const reviews = useReviews();
  const dictation = useDictation();
  const vocabLog = useVocabLog();
  // "bây giờ" cố định cho lần mở trang (render phải thuần)
  const [now] = useState(() => Date.now());

  const activity = useMemo(() => buildActivity(attempts, reviews, dictation, vocabLog), [attempts, reviews, dictation, vocabLog]);
  const streak = streakOf(activity, now);
  // 7 ngày gần nhất (cũ → mới): ngày nào có học
  const week = Array.from({ length: 7 }, (_, i) => (activity.get(dayKey(startOfDay(now) - (6 - i) * DAY)) ?? 0) > 0);
  const prediction = useMemo(() => predictScore(attempts, now), [attempts, now]);

  if (!attempts.length && !activity.size) return null;

  const date = new Date(now).toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" });

  return (
    <section aria-labelledby="today" className="step-fade mb-10">
      <div className="flex items-baseline justify-between gap-3">
        <h1 id="today" className="text-2xl font-bold">
          Hôm nay
        </h1>
        <span className="text-sm text-muted first-letter:uppercase">{date}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* lịch học 16 tuần gần nhất */}
        <Link
          href="/history"
          className="rounded-2xl border border-line bg-surface p-5 transition hover:border-primary sm:col-span-2"
        >
          <div className="text-sm font-medium text-muted">Lịch học 16 tuần gần nhất</div>
          <StudyHeatmap activity={activity} today={startOfDay(now)} fluid />
        </Link>

        <StatCard href="/history" icon="streak" label="Chuỗi ngày học" color="text-orange-500 dark:text-orange-400" tint="bg-orange-500/10">
          <WeekRing
            days={week}
            color="stroke-orange-500 dark:stroke-orange-400"
            label={`Chuỗi ${streak} ngày học liên tiếp; ${week.filter(Boolean).length}/7 ngày gần nhất có học`}
          >
            <div className="text-3xl leading-none font-bold">
              <CountUp value={streak} />
            </div>
            <div className="mt-1 text-xs text-muted">ngày liên tiếp</div>
          </WeekRing>
        </StatCard>

        <StatCard href="/history" icon="history" label="Điểm dự đoán">
          <ProgressRing
            value={(prediction.total ?? 0) / 990}
            color="stroke-teal-500 dark:stroke-teal-400"
            label={prediction.total != null ? `Điểm dự đoán ${prediction.total} trên 990` : "Chưa đủ dữ liệu để dự đoán điểm"}
          >
            <div className="text-3xl leading-none font-bold">
              {prediction.total != null ? <CountUp value={prediction.total} duration={1100} /> : <span className="text-muted">—</span>}
            </div>
            <div className="mt-1 text-xs text-muted">/ 990</div>
          </ProgressRing>
        </StatCard>
      </div>
    </section>
  );
}

function StatCard({
  href,
  icon,
  label,
  color,
  tint,
  children,
}: {
  href: string;
  icon: "streak" | "history";
  label: string;
  color?: string;
  tint?: string;
  children: ReactNode;
}) {
  const s = icon === "streak" ? null : sectionOf(href);
  return (
    <Link href={href} className="group flex flex-col rounded-2xl border border-line bg-surface p-5 transition hover:border-primary">
      <div className="flex items-center gap-2 text-sm font-medium text-muted">
        <span className={`grid size-7 place-items-center rounded-lg ${tint ?? s?.tint}`}>
          <Icon
            name={icon}
            className={`size-4 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none ${color ?? s?.color}`}
          />
        </span>
        {label}
      </div>
      {/* thẻ cao bằng ô lịch học bên cạnh → căn vòng tròn vào giữa phần còn lại thay vì dồn lên trên */}
      <div className="mt-4 flex flex-1 flex-col items-center justify-center">{children}</div>
    </Link>
  );
}
