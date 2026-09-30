import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

type UnderstandingResult = Parameters<typeof prisma.goalUnderstanding.create>[0]["data"]["result"];

/**
 * Stores what onboarding understood from a typed goal, so tests reach the "Here's what I
 * understood" card without the understanding AI task. `result` is the task's normalized output.
 */
export async function goalUnderstandingFixture({
  goal,
  language = "en",
  result,
}: {
  goal: string;
  language?: string;
  result: UnderstandingResult;
}) {
  const normalizedPrompt = normalizeString(goal);
  const data = { generatedAt: new Date(), model: "test", promptVersion: "test", result };

  return prisma.goalUnderstanding.upsert({
    create: { ...data, language, normalizedPrompt },
    update: data,
    where: { languageNormalizedPrompt: { language, normalizedPrompt } },
  });
}
