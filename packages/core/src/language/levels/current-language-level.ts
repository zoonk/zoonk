import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { formatCefrScore } from "@zoonk/utils/cefr";
import { type JsonObject, isJsonObject } from "@zoonk/utils/json";
import { TAP_ASSESSED_SKILLS, getMeasuredSkillScore } from "./skill-level-rules";

export async function loadCurrentLanguageLevel(
  goal: Pick<Goal, "details" | "kind" | "targetLanguage" | "userId">,
  db: TransactionClient = prisma,
): Promise<string | null> {
  if (goal.kind !== "language" || !goal.targetLanguage) {
    return null;
  }

  const rows = await db.languageSkillLevel.findMany({
    select: { raisedAt: true, score: true, skill: true, startScore: true },
    where: {
      language: goal.targetLanguage,
      skill: { in: [...TAP_ASSESSED_SKILLS] },
      userId: goal.userId,
    },
  });

  const details = isJsonObject(goal.details) ? goal.details : {};

  const scores = TAP_ASSESSED_SKILLS.flatMap((skill) => {
    const row = rows.find((candidate) => candidate.skill === skill);
    const tested = getMeasuredSkillScore(details, skill);

    if (row && (tested !== null || row.raisedAt !== null || row.score !== row.startScore)) {
      return [row.score];
    }

    return tested ?? [];
  });

  return scores.length > 0 ? formatCefrScore(Math.min(...scores)) : null;
}

export async function loadGoalLevelDetails(
  goal: Pick<Goal, "details" | "kind" | "targetLanguage" | "userId">,
): Promise<JsonObject> {
  const level = await loadCurrentLanguageLevel(goal);
  return { ...(isJsonObject(goal.details) && goal.details), ...(level && { level }) };
}
