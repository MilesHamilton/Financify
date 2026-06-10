import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load .env.local so drizzle-kit can read env vars when run outside Next.js
dotenv.config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // Direct (non-pooled) connection required for DDL migrations.
    // Do not use DATABASE_URL (PgBouncer pooled) for drizzle-kit commands.
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
