import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "src/prisma/migrations",
    seed: "tsx src/prisma/seed.ts",
  },
  schema: "src/prisma",
});
