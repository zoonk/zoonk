import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config();

/** @internal */
export default defineConfig({
  datasource: { url: env("DATABASE_URL_UNPOOLED") },
  migrations: { path: "src/prisma/migrations", seed: "tsx src/prisma/seed.ts" },
  schema: "src/prisma",
});
