// Cấu hình đăng nhập (better-auth) — chỉ dùng phía server.
// Đăng ký / đăng nhập bằng email + mật khẩu (băm scrypt), phiên lưu trong bảng session.
// Chưa có dịch vụ gửi email → chưa có xác minh email / quên mật khẩu.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, schema, type DB } from "@/db";

function secret() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("Thiếu BETTER_AUTH_SECRET");
  return "dev-only-secret-do-not-use-in-production-0123456789";
}

function makeAuth(db: DB) {
  return betterAuth({
    appName: "ĐMToeic",
    secret: secret(),
    baseURL: process.env.BETTER_AUTH_URL,
    // bản preview của Vercel có domain riêng mỗi lần deploy → cho phép thêm domain đó
    trustedOrigins: [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map((h) => `https://${h}`),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
    // trang cá nhân (/account): xoá tài khoản (cần mật khẩu). Không cho đổi email (chưa có dịch vụ gửi email để xác minh).
    user: { deleteUser: { enabled: true } },
    // /change-email không hỏi mật khẩu → chặn hẳn đường gọi trực tiếp (tính năng cũng đang tắt)
    disabledPaths: ["/change-email"],
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 ngày
      // giữ phiên trong cookie đã ký 5 phút → ít truy vấn CSDL (gói free giới hạn kết nối)
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // chống dò mật khẩu: lưu bộ đếm trong CSDL vì mỗi instance serverless có bộ nhớ riêng
    rateLimit: {
      enabled: process.env.NODE_ENV !== "test",
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 3600, max: 5 },
        // đổi mật khẩu / xoá tài khoản cũng thử mật khẩu → giới hạn như đăng nhập
        "/change-password": { window: 600, max: 5 },
        "/delete-user": { window: 600, max: 5 },
      },
    },
    telemetry: { enabled: false },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof makeAuth>;

const g = globalThis as unknown as { __toeicAuth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  if (!g.__toeicAuth) {
    g.__toeicAuth = getDb().then(makeAuth);
    g.__toeicAuth.catch(() => {
      g.__toeicAuth = undefined;
    });
  }
  return g.__toeicAuth;
}

/** Người dùng của request hiện tại, hoặc null */
export async function getSessionUser(headers: Headers) {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers });
  return s?.user ?? null;
}
