import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { logInfo } from "@zoonk/utils/logger";
import { prisma } from "../index";
import { isLocalDevelopmentDatabase } from "../local-database";
import { SEED_LANGUAGES, type SeedLanguage } from "../prisma/seed/v2/_utils/localize";
import { libraryIds } from "../prisma/seed/v2/library/library-ids";
import {
  type BackfillTarget,
  applyEnemAreaManifest,
  prepareEnemAreaManifest,
} from "./_enem-areas/manifest";

const TRANSACTION_TIMEOUT_MS = 30_000;
const DEFAULT_DATABASE_PORT = "5432";

const { values } = parseArgs({
  options: {
    "allow-remote-apply": { default: false, type: "boolean" },
    apply: { default: false, type: "boolean" },
    language: { default: "pt", type: "string" },
    manifest: { type: "string" },
  },
});

function readLanguage(value: string): SeedLanguage {
  const language = SEED_LANGUAGES.find((candidate) => candidate === value);

  if (!language) {
    throw new Error("Only en and pt ENEM scopes are supported");
  }

  return language;
}

async function getTarget(): Promise<BackfillTarget> {
  const url = new URL(process.env.DATABASE_URL ?? "");

  const [database] = await prisma.$transaction(async (db) => {
    await db.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    return db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  });

  if (!database) {
    throw new Error("Cannot identify target database");
  }

  return { database: database.name, host: url.hostname, port: url.port || DEFAULT_DATABASE_PORT };
}

try {
  const language = readLanguage(values.language);

  const scope = {
    blueprintId: libraryIds.blueprint("enem", language),
    courseId: libraryIds.course("enem", language),
    language,
  };

  const target = await getTarget();
  const manifestPath = values.manifest;

  if (!manifestPath) {
    throw new Error(
      "Pass --manifest <path>: dry run writes it; --apply reads the owner-reviewed file",
    );
  }

  if (values.apply) {
    if (
      !isLocalDevelopmentDatabase(process.env.DATABASE_URL ?? "") &&
      !values["allow-remote-apply"]
    ) {
      throw new Error("Remote apply requires the owner's explicit --allow-remote-apply action");
    }

    const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));

    const result = await prisma.$transaction(
      (db) => applyEnemAreaManifest({ db, manifest, scope, target }),
      { isolationLevel: "Serializable", timeout: TRANSACTION_TIMEOUT_MS },
    );

    logInfo("ENEM chapter area backfill applied", { ...result, scope, target });
  } else {
    const manifest = await prisma.$transaction(
      async (db) => {
        await db.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        return prepareEnemAreaManifest({ db, scope, target });
      },
      { isolationLevel: "RepeatableRead", timeout: TRANSACTION_TIMEOUT_MS },
    );

    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    logInfo("ENEM chapter area backfill dry run", {
      candidates: manifest.candidates.length,
      examCourseLink: manifest.examCourseLink,
      manifestPath,
      nullCandidates: manifest.candidates.filter((row) => row.currentArea === null).length,
      scope,
      sourceFingerprint: manifest.sourceFingerprint,
      target,
      unresolved: manifest.unresolved.length,
    });
  }
} finally {
  await prisma.$disconnect();
}
