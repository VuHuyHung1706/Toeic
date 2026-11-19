import { defineConfig } from "drizzle-kit";

// `npm run db:generate` sinh file SQL vào drizzle/ từ src/db/schema.ts (không cần kết nối CSDL).
// `npm run db:migrate` áp migration lên DATABASE_URL (xem scripts/migrate.ts).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
