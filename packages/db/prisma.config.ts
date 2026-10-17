import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config();

/** @internal */
export default defineConfig({
  datasource: { url: env("DATABASE_URL_UNPOOLED") },
  // The regular seed, then core's v2 seed, whose plans need core's planner. Prisma runs the seed
  // command without a shell, so `prisma:seed` chains them.
  migrations: { path: "src/prisma/migrations", seed: "pnpm run prisma:seed" },
  schema: "src/prisma",
});
