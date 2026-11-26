import { isJsonObject } from "@zoonk/utils/json";
import { type Prisma, type PrismaClient } from "../../../generated/prisma/client";
import { type SeedLanguage } from "../_utils/localize";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { type SeedCourse, type SeedLevelTest } from "./types";

/** Past, so listening questions never read as waiting for their recording. */
const WRITTEN_AT = new Date("2026-01-01T00:00:00.000Z");

/** Hand-written parts fill what a stored bank lacks, so a reseed never replaces what the app wrote. */
function fillBank(stored: unknown, seed: SeedLevelTest): Prisma.InputJsonObject | null {
  const bank = isJsonObject(stored) ? stored : {};
  const hasQuestions = Array.isArray(bank.questions) && bank.questions.length > 0;
  const hasConfirmations = Array.isArray(bank.confirmations);

  if (hasQuestions && hasConfirmations) {
    return null;
  }

  return {
    ...bank,
    ...(!hasQuestions && { questions: seed.questions }),
    ...(!hasConfirmations && { confirmations: seed.confirmations }),
  };
}

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
  const stored = await prisma.languageLevelTest.findUnique({ where: { languagePair } });

  // Checked, so the daily sweep doesn't send hand-written questions to a model.
  const seeded = {
    checkedAt: WRITTEN_AT,
    content: levelTest,
    generatedAt: WRITTEN_AT,
    ...SEED_PROVENANCE,
  };

  if (!stored) {
    await prisma.languageLevelTest.createMany({
      data: [{ ...languagePair, ...seeded }],
      skipDuplicates: true,
    });

    return;
  }

  if (stored.runId === SEED_PROVENANCE.runId) {
    await prisma.languageLevelTest.update({ data: seeded, where: { languagePair } });
    return;
  }

  const filled = fillBank(stored.content, levelTest);

  if (filled) {
    await prisma.languageLevelTest.update({ data: { content: filled }, where: { languagePair } });
  }
}
