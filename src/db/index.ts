// Kết nối CSDL dùng chung cho toàn server.
// - Có DATABASE_URL (Aiven/Postgres khi deploy): node-postgres, pool nhỏ vì gói free giới hạn số kết nối.
//   Migration chạy riêng bằng `npm run db:migrate`.
// - Không có DATABASE_URL (máy dev): PGlite — Postgres chạy bằng WASM, dữ liệu ở .data/pglite,
//   tự áp migration khi mở. Không cần cài Postgres/Docker.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/** SSL cho Aiven: mặc định bật khi URL có sslmode; DATABASE_CA_CERT (PEM) để xác thực chứng chỉ của Aiven. */
function sslConfig(url: string) {
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  if (ca) return { ca, rejectUnauthorized: true };
  if (/sslmode=(require|verify-ca|verify-full)/.test(url)) return { rejectUnauthorized: false };
  return undefined;
}

/** Cấu hình pg.Pool từ URL. pg tự hiểu sslmode trong URL và ghi đè tuỳ chọn ssl → bỏ tham số đó, cấu hình ssl tại đây. */
export function poolConfig(url: string, max = Number(process.env.DATABASE_POOL_MAX ?? 3)) {
  return {
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: sslConfig(url),
    max,
    idleTimeoutMillis: 10_000,
  };
}

async function connectPostgres(url: string): Promise<DB> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  return drizzle(new Pool(poolConfig(url)), { schema });
}

/** PGlite: dataDir = undefined → trong bộ nhớ (dùng cho test) */
export async function connectPglite(dataDir?: string): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) await mkdir(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

const g = globalThis as unknown as { __toeicDb?: Promise<DB> };

/** CSDL dùng chung (giữ qua hot-reload ở dev). */
export function getDb(): Promise<DB> {
  if (!g.__toeicDb) {
    const url = process.env.DATABASE_URL;
    if (!url && process.env.NODE_ENV === "production" && !process.env.ALLOW_PGLITE) {
      throw new Error("Thiếu DATABASE_URL (bản production cần Postgres, vd Aiven).");
    }
    g.__toeicDb = url ? connectPostgres(url) : connectPglite(path.join(process.cwd(), ".data", "pglite"));
    g.__toeicDb.catch(() => {
      g.__toeicDb = undefined;
    });
  }
  return g.__toeicDb;
}

export { schema };
