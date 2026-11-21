import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { type JsonObject, isJsonObject } from "@zoonk/utils/json";
import { getOverallLevel } from "./skill-level-rules";

export async function loadCurrentLanguageLevel(
  goal: Pick<Goal, "kind" | "targetLanguage" | "userId">,
  db: TransactionClient = prisma,
): Promise<string | null> {
  if (goal.kind !== "language" || !goal.targetLanguage) {
    return null;
  }

  const rows = await db.languageSkillLevel.findMany({
    select: { raisedAt: true, score: true, startScore: true },
    where: {
      language: goal.targetLanguage,
      skill: { in: ["reading", "listening"] },
      userId: goal.userId,
    },
  });

  const moved = rows.some(
    ({ raisedAt, score, startScore }) => raisedAt !== null || score !== startScore,
  );

  return moved ? getOverallLevel(rows.map(({ score }) => score)) : null;
}

export async function loadGoalLevelDetails(
  goal: Pick<Goal, "details" | "kind" | "targetLanguage" | "userId">,
): Promise<JsonObject> {
  const level = await loadCurrentLanguageLevel(goal);
  return { ...(isJsonObject(goal.details) && goal.details), ...(level && { level }) };
}
