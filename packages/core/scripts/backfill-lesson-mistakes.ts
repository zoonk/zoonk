import { parseArgs } from "node:util";
import { prisma } from "@zoonk/db";
import { isLocalDevelopmentDatabase } from "@zoonk/db/local-database";
import { logError } from "@zoonk/utils/logger";
import { backfillLessonMistakes } from "./_utils/backfill-lesson-mistakes";

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean" },
      "dry-run": { type: "boolean" },
      production: { type: "boolean" },
    },
  });

  if (values.apply && values["dry-run"]) {
    throw new Error("Choose --apply or --dry-run, not both.");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  if (values.apply && !values.production && !isLocalDevelopmentDatabase(process.env.DATABASE_URL)) {
    throw new Error("A non-development database requires --production to apply this recovery.");
  }

  const summary = await backfillLessonMistakes({ dryRun: !values.apply });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  logError(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
