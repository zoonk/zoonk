import { isJsonObject } from "@zoonk/utils/json";
import { type Prisma, type PrismaClient } from "../../../generated/prisma/client";
import { type SeedLanguage } from "../_utils/localize";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { type SeedCourse } from "./types";

/** Past, so listening questions never read as waiting for their recording. */
const WRITTEN_AT = new Date("2026-01-01T00:00:00.000Z");

/** The seed's entries replace their own ids; every entry the app wrote stays. */
function mergeById(stored: unknown, seeded: readonly { id: string }[]): Prisma.InputJsonValue[] {
  const ids = new Set(seeded.map(({ id }) => id));

  const kept = (Array.isArray(stored) ? stored : []).filter(
    (entry): entry is Prisma.InputJsonValue =>
      entry !== null && !(isJsonObject(entry) && typeof entry.id === "string" && ids.has(entry.id)),
  );

  return [...kept, ...seeded];
}

/**
 * Every bank for the pair holds the seed's questions and level checks, so a level check opens with
 * no model call, and a reseed never removes what the app wrote or appended.
 */
export async function writeLevelTest({
  course,
  language,
  prisma,
}: {
  course: SeedCourse;
  language: SeedLanguage;
  prisma: PrismaClient;
}): Promise<void> {
  const { levelTest, targetLanguage } = course;

  if (!levelTest || !targetLanguage) {
    return;
  }

  const languagePair = { language, targetLanguage };

  // Checked, so the daily sweep doesn't send hand-written questions to a model.
  await prisma.languageLevelTest.createMany({
    data: [
      {
        ...languagePair,
        checkedAt: WRITTEN_AT,
        content: levelTest,
        generatedAt: WRITTEN_AT,
        ...SEED_PROVENANCE,
      },
    ],
    skipDuplicates: true,
  });

  // The same row lock the app takes to append level checks, so neither write loses the other's.
  await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ content: unknown }[]>`
      SELECT content FROM language_level_tests
      WHERE language = ${language} AND target_language = ${targetLanguage}
      FOR UPDATE`;

    const bank = isJsonObject(row?.content) ? row.content : {};

    await tx.languageLevelTest.update({
      data: {
        content: {
          ...bank,
          confirmations: mergeById(bank.confirmations, levelTest.confirmations),
          questions: mergeById(bank.questions, levelTest.questions),
        },
      },
      where: { languagePair },
    });
  });
}
