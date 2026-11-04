import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "./data/app.db";
fs.mkdirSync(path.dirname(url), { recursive: true });

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
