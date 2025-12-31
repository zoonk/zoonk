import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const shadowDatabaseUrl =
  process.env.NODE_ENV === "production"
    ? env("DATABASE_URL_UNPOOLED")
    : undefined;

export default defineConfig({
  datasource: {
    shadowDatabaseUrl,
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "src/prisma/migrations",
    seed: "tsx src/prisma/seed.ts",
  },
  schema: "src/prisma",
  typedSql: { path: "src/prisma/sql" },
});
