import { prisma } from "@zoonk/db";
import { beforeAll } from "vitest";

async function truncateAllTables() {
  try {
    const tablenames = await prisma.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename::text FROM pg_tables WHERE schemaname='public'`;

    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== "_prisma_migrations")
      .map((name) => `"public"."${name}"`)
      .join(", ");

    if (!tables) {
      return;
    }

    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  } catch (error) {
    console.error({ error });
  }
}

beforeAll(async () => {
  await truncateAllTables();
});
