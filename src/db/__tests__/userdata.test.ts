import { beforeAll, describe, expect, it } from "vitest";
import { connectPglite, type DB } from "@/db";
import * as t from "@/db/schema";
import { applyOps, getSnapshot, syncBodySchema } from "@/db/userdata";
import { coalesceOps, type SyncOp } from "@/lib/sync-types";
import type { Attempt } from "@/lib/types";

const attempt = (id: string, submittedAt: number, extra: Partial<Attempt> = {}): Attempt => ({
  id,
  testId: "2025-test1",
  testTitle: "ETS 2025 Test 1",
  mode: "practice",
  parts: [5],
  answers: { 101: "A", 102: "C" },
  startedAt: submittedAt - 60_000,
  submittedAt,
  durationSec: 60,
  byPart: { 5: { correct: 1, total: 2 } },
  correct: 1,
  total: 2,
  listeningCorrect: 0,
  readingCorrect: 1,
  ...extra,
});

let db: DB;
beforeAll(async () => {
  db = await connectPglite(); // trong bộ nhớ, đã migrate
  await db.insert(t.user).values([
    { id: "u1", name: "A", email: "a@example.test" },
    { id: "u2", name: "B", email: "b@example.test" },
  ]);
}, 60_000);

describe("coalesceOps", () => {
  it("giữ thao tác cuối cho mỗi đối tượng, vocabDay lấy số lớn nhất", () => {
    const ops: SyncOp[] = [
      { t: "pref.put", key: "x", value: "1" },
      { t: "review.add", key: "q:1", at: 1, ok: true },
      { t: "vocabDay.put", day: "2026-11-19", count: 5 },
      { t: "pref.put", key: "x", value: "2" },
      { t: "review.add", key: "q:1", at: 2, ok: false },
      { t: "vocabDay.put", day: "2026-11-19", count: 3 },
    ];
    expect(coalesceOps(ops)).toEqual([
      { t: "review.add", key: "q:1", at: 1, ok: true },
      { t: "pref.put", key: "x", value: "2" },
      { t: "review.add", key: "q:1", at: 2, ok: false },
      { t: "vocabDay.put", day: "2026-11-19", count: 5 },
    ]);
  });
});

describe("applyOps / getSnapshot", () => {
  it("lưu và đọc lại đủ các loại dữ liệu", async () => {
    await applyOps(db, "u1", [
      { t: "attempt.put", a: attempt("a1", 1000) },
      { t: "attempt.put", a: attempt("a2", 2000, { mode: "full", listeningScore: 400, readingScore: 350, totalScore: 750 }) },
      { t: "review.add", key: "2025-test1:101", at: 10, ok: false },
      { t: "review.add", key: "2025-test1:101", at: 20, ok: true },
      { t: "dictation.add", e: { at: 30, testId: "2025-test1", groupId: "g1", correct: 3, total: 5 } },
      { t: "vocab.put", word: "deadline", card: { box: 2, due: 99, lastAt: 40, reviews: 2, lapses: 0 } },
      { t: "vocabDay.put", day: "2026-11-19", count: 4 },
      { t: "pref.put", key: "readMode", value: "bi" },
      { t: "progress.put", key: "2025-test1:practice:5", data: { answers: { 101: "B" }, flagged: [102], elapsedSec: 12, groupIndex: 1, startedAt: 5 } },
    ]);
    const s = await getSnapshot(db, "u1");
    expect(s.attempts.map((a) => a.id)).toEqual(["a2", "a1"]); // mới nhất trước
    expect(s.attempts[0]).toEqual(attempt("a2", 2000, { mode: "full", listeningScore: 400, readingScore: 350, totalScore: 750 }));
    expect(s.attempts[1]).not.toHaveProperty("totalScore");
    expect(s.reviews["2025-test1:101"]).toEqual([{ at: 10, ok: false }, { at: 20, ok: true }]);
    expect(s.dictation).toHaveLength(1);
    expect(s.vocab.deadline.box).toBe(2);
    expect(s.vocabLog["2026-11-19"]).toBe(4);
    expect(s.prefs.readMode).toBe("bi");
    expect(s.progress["2025-test1:practice:5"].flagged).toEqual([102]);
  });

  it("idempotent: gửi lại không nhân đôi; cập nhật/xoá đúng; vocabDay không giảm", async () => {
    await applyOps(db, "u1", [
      { t: "review.add", key: "2025-test1:101", at: 20, ok: true }, // trùng
      { t: "vocab.put", word: "deadline", card: { box: 3, due: 199, lastAt: 50, reviews: 3, lapses: 0 } },
      { t: "vocabDay.put", day: "2026-11-19", count: 2 },
      { t: "attempt.del", id: "a1" },
      { t: "progress.del", key: "2025-test1:practice:5" },
      { t: "pref.put", key: "readMode", value: "vi" },
    ]);
    const s = await getSnapshot(db, "u1");
    expect(s.reviews["2025-test1:101"]).toHaveLength(2);
    expect(s.vocab.deadline.box).toBe(3);
    expect(s.vocabLog["2026-11-19"]).toBe(4);
    expect(s.attempts.map((a) => a.id)).toEqual(["a2"]);
    expect(s.progress).toEqual({});
    expect(s.prefs.readMode).toBe("vi");
  });

  it("dữ liệu tách biệt giữa người dùng (cùng id bài làm vẫn không đè nhau)", async () => {
    await applyOps(db, "u2", [{ t: "attempt.put", a: attempt("a2", 3000, { correct: 2 }) }]);
    const [s1, s2] = await Promise.all([getSnapshot(db, "u1"), getSnapshot(db, "u2")]);
    expect(s1.attempts[0].correct).toBe(1);
    expect(s2.attempts.map((a) => a.correct)).toEqual([2]);
    expect(s2.vocab).toEqual({});
    await applyOps(db, "u2", [{ t: "attempt.del", id: "a2" }]);
    expect((await getSnapshot(db, "u1")).attempts).toHaveLength(1);
  });
});

describe("syncBodySchema", () => {
  it("từ chối thao tác lạ hoặc sai kiểu", () => {
    expect(syncBodySchema.safeParse({ ops: [{ t: "user.drop" }] }).success).toBe(false);
    expect(syncBodySchema.safeParse({ ops: [{ t: "review.add", key: "k", at: "x", ok: true }] }).success).toBe(false);
    expect(syncBodySchema.safeParse({ ops: [{ t: "attempt.put", a: { ...attempt("a", 100_000), mode: "hack" } }] }).success).toBe(false);
    expect(syncBodySchema.safeParse({ ops: [{ t: "attempt.put", a: attempt("a", 100_000) }] }).success).toBe(true);
  });
});
