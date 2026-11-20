// Đồng bộ màn hình thi thật với audio cả đề (mốc audioStart/audioEnd của từng nhóm câu Part 1–4).
import type { PartNo, QuestionGroup } from "./types";

/** Mọi nhóm câu nghe đều có mốc thời gian → phần nghe tự chuyển câu theo audio */
export function hasAudioTimeline(groups: QuestionGroup[]): boolean {
  const listening = groups.filter((g) => g.part <= 4);
  return listening.length > 0 && listening.every((g) => g.audioStart != null && g.audioEnd != null);
}

/** Vị trí trong danh sách nhóm câu nghe mà audio đang đọc tại giây t; -1 khi còn ở phần hướng dẫn đầu */
export function listeningIndexAt(listening: QuestionGroup[], t: number): number {
  let idx = -1;
  for (let i = 0; i < listening.length; i++) {
    if (listening[i].audioStart! <= t + 0.25) idx = i;
    else break;
  }
  return idx;
}

/**
 * Part mà audio đang đọc phần hướng dẫn (Directions), hoặc null khi đang ở một câu:
 * trước câu đầu tiên → Part 1; sau câu cuối của một part mà chưa tới câu đầu part kế → part kế.
 */
export function directionsPartAt(listening: QuestionGroup[], t: number): PartNo | null {
  if (!listening.length) return null;
  const i = listeningIndexAt(listening, t);
  if (i < 0) return listening[0].part;
  const cur = listening[i];
  const next = listening[i + 1];
  if (next && next.part !== cur.part && t > cur.audioEnd! + 0.5) return next.part;
  return null;
}
