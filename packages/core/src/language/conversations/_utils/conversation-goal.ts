import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type CefrLevel, toCefrLevel } from "@zoonk/utils/cefr";
import { readGoalDetails } from "../../_utils/language-goal";
import { getStartScore } from "../../levels/skill-level-rules";

/** The band the character speaks at: the learner's speaking level, rounded down to its band. */
export async function getSpeakingLevel({
  goal,
  targetLanguage,
  userId,
}: {
  goal: Goal | null;
  targetLanguage: string;
  userId: string;
}): Promise<CefrLevel> {
  const row = await prisma.languageSkillLevel.findUnique({
    select: { score: true },
    where: { userLanguageSkill: { language: targetLanguage, skill: "speaking", userId } },
  });

  return toSpeakingLevel({ goal, score: row?.score ?? null });
}

/** The speaking band from the learner's saved speaking score, or the goal's starting one without it. */
export function toSpeakingLevel({
  goal,
  score,
}: {
  goal: Goal | null;
  score: number | null;
}): CefrLevel {
  return toCefrLevel(score ?? getStartScore({ details: readGoalDetails(goal), skill: "speaking" }));
}
