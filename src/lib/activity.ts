// Hoạt động học theo ngày (câu đã làm, lần ôn, đoạn nghe chép, thẻ từ vựng) và chuỗi ngày học liên tiếp.
// Dùng chung cho trang Tiến độ và khối "Hôm nay" ở trang chủ.
import { dayKey } from "./storage";
import type { DictationEvent, ReviewLog } from "./sync-types";
import type { Attempt } from "./types";

export const DAY = 86_400_000;

export function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Số hoạt động theo ngày, khoá "yyyy-m-d" */
export function buildActivity(
  attempts: Attempt[],
  reviews: ReviewLog,
  dictation: DictationEvent[],
  vocabLog: Record<string, number>,
): Map<string, number> {
  const activity = new Map<string, number>();
  const add = (t: number, n: number) => activity.set(dayKey(t), (activity.get(dayKey(t)) ?? 0) + n);
  for (const a of attempts) add(a.submittedAt, Object.keys(a.answers).length);
  for (const list of Object.values(reviews)) for (const r of list) add(r.at, 1);
  for (const d of dictation) add(d.at, 1);
  // nhật ký ôn thẻ từ vựng đã được gộp theo ngày
  for (const [k, n] of Object.entries(vocabLog)) activity.set(k, (activity.get(k) ?? 0) + n);
  return activity;
}

/** Chuỗi ngày học liên tiếp, tính đến hôm nay (hoặc hôm qua nếu hôm nay chưa học) */
export function streakOf(activity: Map<string, number>, today: number): number {
  let streak = 0;
  let t = startOfDay(today);
  if (!activity.get(dayKey(t))) t -= DAY;
  while (activity.get(dayKey(t))) {
    streak += 1;
    t -= DAY;
  }
  return streak;
}
