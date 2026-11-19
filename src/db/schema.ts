// Lược đồ CSDL (Drizzle ORM, PostgreSQL).
// - 4 bảng đầu là bảng chuẩn của better-auth (tên trường camelCase như thư viện mong đợi).
// - Các bảng còn lại lưu dữ liệu học của người dùng; nội dung đề vẫn là JSON tĩnh trong content/.
// Thời điểm phía client (at, due, startedAt…) là mili-giây kiểu number như trong localStorage.
import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

// ---------------- better-auth ----------------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------- dữ liệu học ----------------
const userId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
const ms = (name: string) => bigint(name, { mode: "number" });

/** Bài làm đã nộp (khớp kiểu Attempt) */
export const attempt = pgTable(
  "attempt",
  {
    id: text("id").notNull(),
    userId: userId(),
    testId: text("test_id").notNull(),
    testTitle: text("test_title").notNull(),
    mode: text("mode").notNull(),
    parts: integer("parts").array().notNull(),
    answers: jsonb("answers").$type<Record<string, string>>().notNull(),
    byPart: jsonb("by_part").$type<Record<string, unknown>>().notNull(),
    startedAt: ms("started_at").notNull(),
    submittedAt: ms("submitted_at").notNull(),
    durationSec: integer("duration_sec").notNull(),
    correct: integer("correct").notNull(),
    total: integer("total").notNull(),
    listeningCorrect: integer("listening_correct").notNull(),
    readingCorrect: integer("reading_correct").notNull(),
    listeningScore: integer("listening_score"),
    readingScore: integer("reading_score"),
    totalScore: integer("total_score"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index("attempt_user_submitted_idx").on(t.userId, t.submittedAt)],
);

/** Một lần làm lại câu sai; qkey = "testId:số câu" */
export const reviewEvent = pgTable(
  "review_event",
  {
    userId: userId(),
    qkey: text("qkey").notNull(),
    at: ms("at").notNull(),
    ok: boolean("ok").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.qkey, t.at] })],
);

/** Một lần luyện nghe điền từ */
export const dictationEvent = pgTable(
  "dictation_event",
  {
    userId: userId(),
    at: ms("at").notNull(),
    testId: text("test_id").notNull(),
    groupId: text("group_id").notNull(),
    correct: integer("correct").notNull(),
    total: integer("total").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.at, t.groupId] })],
);

/** Thẻ từ vựng (hộp Leitner) */
export const vocabCard = pgTable(
  "vocab_card",
  {
    userId: userId(),
    word: text("word").notNull(),
    box: integer("box").notNull(),
    due: ms("due").notNull(),
    lastAt: ms("last_at").notNull(),
    reviews: integer("reviews").notNull(),
    lapses: integer("lapses").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.word] })],
);

/** Số thẻ từ vựng đã ôn theo ngày (day = "YYYY-M-D" theo giờ máy người học) */
export const vocabDay = pgTable(
  "vocab_day",
  {
    userId: userId(),
    day: text("day").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

/** Tiến độ bài đang làm dở; key = "testId:mode:parts" */
export const examProgress = pgTable(
  "exam_progress",
  {
    userId: userId(),
    key: text("key").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/** Tuỳ chọn hiển thị (chế độ song ngữ, bộ lọc từ vựng…) */
export const userPref = pgTable(
  "user_pref",
  {
    userId: userId(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/** Đếm số request theo IP + đường dẫn cho giới hạn tần suất của better-auth (dùng chung giữa các instance serverless) */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
