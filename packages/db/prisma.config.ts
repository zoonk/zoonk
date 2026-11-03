import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config();

// Prisma's CLI gives up connecting after 5 s by default, sooner than an idle Neon compute or a busy local server can answer:
// https://neon.com/docs/guides/prisma
const url = new URL(env("DATABASE_URL_UNPOOLED"));
url.searchParams.set("connect_timeout", "30");

/** @internal */
export default defineConfig({
  datasource: { url: url.href },
  // The regular seed, then core's seed of Library courses and personas, whose plans need core's planner. Prisma runs the seed
  // command without a shell, so `prisma:seed` chains them.
  migrations: { path: "src/prisma/migrations", seed: "pnpm run prisma:seed" },
  schema: "src/prisma",
});
