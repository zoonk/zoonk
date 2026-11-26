import { type PrismaClient } from "../../../generated/prisma/client";
import { type SeedLanguage } from "../_utils/localize";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { type SeedCourse } from "./types";

/** Past, so listening questions never read as waiting for their recording. */
const WRITTEN_AT = new Date("2026-01-01T00:00:00.000Z");

/** A bank the app wrote for the pair is never replaced, which would make it pay to write it again. */
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

  const pair = { language, targetLanguage };

  // Checked, so the daily sweep doesn't send hand-written questions to a model.
  const data = {
    checkedAt: WRITTEN_AT,
    content: levelTest,
    generatedAt: WRITTEN_AT,
    ...SEED_PROVENANCE,
  };

  await prisma.languageLevelTest.createMany({ data: [{ ...pair, ...data }], skipDuplicates: true });

  await prisma.languageLevelTest.updateMany({
    data,
    where: { ...pair, runId: SEED_PROVENANCE.runId },
  });
}
