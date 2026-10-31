import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Carga .env.local igual que Next.js, para usar la misma DATABASE_URL.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
