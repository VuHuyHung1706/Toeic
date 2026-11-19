// Đọc/ghi dữ liệu học của một người dùng (server). Dùng bởi /api/me/sync và test.
import { and, desc, eq, getTableColumns, inArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Attempt } from "@/lib/types";
import {
  MAX_OPS_PER_REQUEST,
  SNAPSHOT_LIMITS,
  coalesceOps,
  type Progress,
  type SyncOp,
  type UserSnapshot,
} from "@/lib/sync-types";
import type { DB } from "./index";
import * as t from "./schema";

// ---------------- kiểm tra dữ liệu gửi lên ----------------
const str = (max = 200) => z.string().min(1).max(max);
const int = z.number().int().min(0).max(1e7);
const msTime = z.number().int().min(0).max(1e14);
const letterMap = z.record(z.string().regex(/^\d{1,3}$/), z.string().max(2));

const attemptSchema = z.object({
  id: str(100),
  testId: str(),
  testTitle: z.string().max(300),
  mode: z.enum(["full", "practice"]),
  parts: z.array(z.number().int().min(1).max(7)).max(7),
  answers: letterMap,
  startedAt: msTime,
  submittedAt: msTime,
  durationSec: int,
  byPart: z.record(z.string().regex(/^[1-7]$/), z.object({ correct: int, total: int })),
  correct: int,
  total: int,
  listeningCorrect: int,
  readingCorrect: int,
  listeningScore: z.number().int().min(0).max(990).optional(),
  readingScore: z.number().int().min(0).max(990).optional(),
  totalScore: z.number().int().min(0).max(990).optional(),
});

const progressSchema = z.object({
  answers: letterMap,
  flagged: z.array(z.number().int().min(0).max(999)).max(300),
  elapsedSec: int,
  groupIndex: int,
  audioTime: z.number().min(0).max(1e6).optional(),
  startedAt: msTime,
});

const opSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("attempt.put"), a: attemptSchema }),
  z.object({ t: z.literal("attempt.del"), id: str(100) }),
  z.object({ t: z.literal("review.add"), key: str(), at: msTime, ok: z.boolean() }),
  z.object({
    t: z.literal("dictation.add"),
    e: z.object({ at: msTime, testId: str(), groupId: str(), correct: int, total: int }),
  }),
  z.object({
    t: z.literal("vocab.put"),
    word: str(100),
    card: z.object({ box: int, due: msTime, lastAt: msTime, reviews: int, lapses: int }),
  }),
  z.object({ t: z.literal("vocab.del"), word: str(100) }),
  z.object({ t: z.literal("vocabDay.put"), day: z.string().regex(/^\d{4}-\d{1,2}-\d{1,2}$/), count: int }),
  z.object({ t: z.literal("pref.put"), key: str(100), value: z.string().max(500) }),
  z.object({ t: z.literal("progress.put"), key: str(300), data: progressSchema }),
  z.object({ t: z.literal("progress.del"), key: str(300) }),
]);

export const syncBodySchema = z.object({ ops: z.array(opSchema).max(MAX_OPS_PER_REQUEST) });

// ---------------- ghi ----------------
/** set = excluded.<cột> cho mọi cột trừ khoá chính → "insert … on conflict do update" */
function excludedSet<T extends PgTable>(table: T, keys: string[]) {
  const set: Record<string, SQL> = {};
  for (const [prop, col] of Object.entries(getTableColumns(table)) as [string, PgColumn][]) {
    if (!keys.includes(prop)) set[prop] = sql.raw(`excluded."${col.name}"`);
  }
  return set;
}

/** Áp các thao tác (đã kiểm tra) cho một người dùng trong một giao dịch. Trả số thao tác sau khi gộp. */
export async function applyOps(db: DB, userId: string, input: SyncOp[]): Promise<number> {
  const ops = coalesceOps(input);
  const pick = <K extends SyncOp["t"]>(k: K) => ops.filter((o): o is Extract<SyncOp, { t: K }> => o.t === k);

  await db.transaction(async (tx) => {
    const attempts = pick("attempt.put");
    if (attempts.length)
      await tx
        .insert(t.attempt)
        .values(
          attempts.map(({ a }) => ({
            ...a,
            userId,
            parts: a.parts as number[],
            answers: a.answers as Record<string, string>,
            byPart: a.byPart as Record<string, unknown>,
            listeningScore: a.listeningScore ?? null,
            readingScore: a.readingScore ?? null,
            totalScore: a.totalScore ?? null,
          })),
        )
        .onConflictDoUpdate({ target: [t.attempt.userId, t.attempt.id], set: excludedSet(t.attempt, ["userId", "id"]) });
    const attemptDel = pick("attempt.del").map((o) => o.id);
    if (attemptDel.length)
      await tx.delete(t.attempt).where(and(eq(t.attempt.userId, userId), inArray(t.attempt.id, attemptDel)));

    const reviews = pick("review.add");
    if (reviews.length)
      await tx
        .insert(t.reviewEvent)
        .values(reviews.map((o) => ({ userId, qkey: o.key, at: o.at, ok: o.ok })))
        .onConflictDoNothing();

    const dict = pick("dictation.add");
    if (dict.length)
      await tx
        .insert(t.dictationEvent)
        .values(dict.map((o) => ({ userId, ...o.e })))
        .onConflictDoNothing();

    const cards = pick("vocab.put");
    if (cards.length)
      await tx
        .insert(t.vocabCard)
        .values(cards.map((o) => ({ userId, word: o.word, ...o.card })))
        .onConflictDoUpdate({ target: [t.vocabCard.userId, t.vocabCard.word], set: excludedSet(t.vocabCard, ["userId", "word"]) });
    const cardDel = pick("vocab.del").map((o) => o.word);
    if (cardDel.length)
      await tx.delete(t.vocabCard).where(and(eq(t.vocabCard.userId, userId), inArray(t.vocabCard.word, cardDel)));

    const days = pick("vocabDay.put");
    if (days.length)
      await tx
        .insert(t.vocabDay)
        .values(days.map((o) => ({ userId, day: o.day, count: o.count })))
        .onConflictDoUpdate({
          target: [t.vocabDay.userId, t.vocabDay.day],
          set: { count: sql`greatest(${t.vocabDay.count}, excluded."count")` },
        });

    const prefs = pick("pref.put");
    if (prefs.length)
      await tx
        .insert(t.userPref)
        .values(prefs.map((o) => ({ userId, key: o.key, value: o.value })))
        .onConflictDoUpdate({ target: [t.userPref.userId, t.userPref.key], set: { value: sql`excluded."value"` } });

    const progress = pick("progress.put");
    if (progress.length)
      await tx
        .insert(t.examProgress)
        .values(progress.map((o) => ({ userId, key: o.key, data: o.data as unknown as Record<string, unknown> })))
        .onConflictDoUpdate({
          target: [t.examProgress.userId, t.examProgress.key],
          set: { data: sql`excluded."data"`, updatedAt: sql`now()` },
        });
    const progressDel = pick("progress.del").map((o) => o.key);
    if (progressDel.length)
      await tx
        .delete(t.examProgress)
        .where(and(eq(t.examProgress.userId, userId), inArray(t.examProgress.key, progressDel)));
  });
  return ops.length;
}

// ---------------- đọc ----------------
export async function getSnapshot(db: DB, userId: string): Promise<UserSnapshot> {
  const [attempts, reviews, dictation, cards, days, prefs, progress] = await Promise.all([
    db
      .select()
      .from(t.attempt)
      .where(eq(t.attempt.userId, userId))
      .orderBy(desc(t.attempt.submittedAt))
      .limit(SNAPSHOT_LIMITS.attempts),
    db.select().from(t.reviewEvent).where(eq(t.reviewEvent.userId, userId)).orderBy(t.reviewEvent.at),
    db
      .select()
      .from(t.dictationEvent)
      .where(eq(t.dictationEvent.userId, userId))
      .orderBy(desc(t.dictationEvent.at))
      .limit(SNAPSHOT_LIMITS.dictation),
    db.select().from(t.vocabCard).where(eq(t.vocabCard.userId, userId)),
    db.select().from(t.vocabDay).where(eq(t.vocabDay.userId, userId)),
    db.select().from(t.userPref).where(eq(t.userPref.userId, userId)),
    db.select().from(t.examProgress).where(eq(t.examProgress.userId, userId)),
  ]);

  const reviewLog: UserSnapshot["reviews"] = {};
  for (const r of reviews) (reviewLog[r.qkey] ??= []).push({ at: r.at, ok: r.ok });
  for (const k in reviewLog) reviewLog[k] = reviewLog[k].slice(-SNAPSHOT_LIMITS.reviewsPerQuestion);

  return {
    attempts: attempts.map(({ userId: _u, listeningScore, readingScore, totalScore, ...a }) => {
      void _u;
      const out = { ...a } as unknown as Attempt;
      if (listeningScore != null) out.listeningScore = listeningScore;
      if (readingScore != null) out.readingScore = readingScore;
      if (totalScore != null) out.totalScore = totalScore;
      return out;
    }),
    reviews: reviewLog,
    dictation: dictation.map(({ at, testId, groupId, correct, total }) => ({ at, testId, groupId, correct, total })),
    vocab: Object.fromEntries(cards.map(({ word, box, due, lastAt, reviews, lapses }) => [word, { box, due, lastAt, reviews, lapses }])),
    vocabLog: Object.fromEntries(days.map((d) => [d.day, d.count])),
    prefs: Object.fromEntries(prefs.map((p) => [p.key, p.value])),
    progress: Object.fromEntries(progress.map((p) => [p.key, p.data as unknown as Progress])),
  };
}
