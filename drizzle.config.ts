import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./database",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_nF6HSGfDXs3O@ep-restless-bar-a70zduuf-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  },
});
