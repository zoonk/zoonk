import { loadEnv } from "vite";

// Load .env.test before importing @zoonk/db (which reads DATABASE_URL at module load time)
const env = loadEnv("test", process.cwd(), "");
process.env.DATABASE_URL = env.DATABASE_URL;

export default async function setup() {
  const { prisma } = await import("@zoonk/db");

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
