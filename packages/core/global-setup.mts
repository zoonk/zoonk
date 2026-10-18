import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import setupTestDatabase from "../db/src/test-database";
import { getTestRunEnvironment } from "../db/src/test-environment";

/** The seed's Prisma pool belongs to this child and closes before the run database is dropped. */
function seedRunLibrary(): void {
  const environment = getTestRunEnvironment();
  const expected = decodeURIComponent(new URL(environment.DATABASE_URL ?? "").pathname.slice(1));

  const script = `
    import { prisma } from "@zoonk/db";
    import { writeSeedV2Library } from "@zoonk/db/seed/v2";
    async function seed() {
      const [database] = await prisma.$queryRaw\`SELECT current_database() AS name\`;
      if (database?.name !== process.env.CORE_TEST_DATABASE_NAME) {
        throw new Error("Core library setup must use this run's cloned test database.");
      }
      await writeSeedV2Library(prisma);
      await prisma.$disconnect();
    }
    seed().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });`;

  const started = performance.now();

  const result = spawnSync(
    process.execPath,
    [createRequire(import.meta.url).resolve("tsx/cli"), "--eval", script],
    {
      cwd: import.meta.dirname,
      env: { ...process.env, ...environment, CORE_TEST_DATABASE_NAME: expected },
      stdio: "inherit",
    },
  );

  if (result.error || result.status !== 0) {
    throw new Error("Core library setup failed.", { cause: result.error });
  }

  process.stdout.write(`[core-library-setup] ${Math.round(performance.now() - started)} ms\n`);
}

export default async function setupCoreDatabase(): Promise<() => Promise<void>> {
  const teardown = await setupTestDatabase();

  try {
    seedRunLibrary();
    return teardown;
  } catch (error) {
    await teardown();
    throw error;
  }
}
