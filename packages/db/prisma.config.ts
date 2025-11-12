import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  schema: path.join("prisma"),
});
