// Áp migration trong drizzle/ lên Postgres ở DATABASE_URL (vd Aiven).
// Chạy: DATABASE_URL=... npm run db:migrate   (hoặc đặt trong .env.local)
// Không có DATABASE_URL → áp vào PGlite local (.data/pglite).
import path from "node:path";

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* không có .env.local */
  }
  const { connectPglite, poolConfig } = await import("../src/db/index");
  const url = process.env.DATABASE_URL;
  const folder = path.join(process.cwd(), "drizzle");
  if (!url) {
    await connectPglite(path.join(process.cwd(), ".data", "pglite")); // tự migrate khi mở
    console.log("Đã migrate PGlite local (.data/pglite)");
    return;
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool(poolConfig(url, 1));
  try {
    await migrate(drizzle(pool), { migrationsFolder: folder });
    console.log("Đã migrate:", new URL(url).host);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
