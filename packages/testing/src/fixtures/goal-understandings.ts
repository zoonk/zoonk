import { readFileSync } from "node:fs";
import { prisma } from "@zoonk/db";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { normalizeString } from "@zoonk/utils/string";

type UnderstandingResult = Parameters<typeof prisma.goalUnderstanding.create>[0]["data"]["result"];

/**
 * The understanding prompt's current version: onboarding reuses only readings the current prompt
 * wrote. Read from the prompt itself, since the task's module needs a server and a Markdown loader.
 */
const PROMPT_VERSION = getPromptVersion({
  systemPrompt: readFileSync(
    new URL("../../../ai/src/tasks/v2/goals/understand-goal.prompt.md", import.meta.url),
    "utf8",
  ),
});

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
  const data = { generatedAt: new Date(), model: "test", promptVersion: PROMPT_VERSION, result };

  return prisma.goalUnderstanding.upsert({
    create: { ...data, language, normalizedPrompt },
    update: data,
    where: { languageNormalizedPrompt: { language, normalizedPrompt } },
  });
}
