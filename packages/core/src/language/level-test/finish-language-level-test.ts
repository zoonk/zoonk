import "server-only";
import { type LanguageSkill, prisma } from "@zoonk/db";
import { formatCefrScore } from "@zoonk/utils/cefr";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { readGoalDetails } from "../_utils/language-goal";
import { getTestStart, loadLevelTestContext } from "./_utils/level-test-state";
import {
  type LevelTestScores,
  getLevelTestScores,
  getOverallScore,
  listLevelTestLevels,
  toLevelLabels,
} from "./level-test-rules";

export type FinishLanguageLevelTestResult =
  | { levels: { label: string; score: number; skill: LanguageSkill }[]; status: "ready" }
  | { status: "notFound" | "notLanguage" | "notReady" | "unauthorized" };

/**
 * The test's levels become where each skill starts; a new test starts them over. A skill the test
 * gave no level (speaking, when the sentence was skipped) keeps what lessons showed, or starts
 * from the goal's level once the learner speaks.
 */
async function saveSkillLevels({
  language,
  scores,
  userId,
}: {
  language: string;
  scores: LevelTestScores;
  userId: string;
}) {
  await prisma.$transaction(
    listLevelTestLevels(scores).map(({ score, skill }) =>
      prisma.languageSkillLevel.upsert({
        create: { language, score, skill, startScore: score, userId },
        update: { score, startScore: score, windowCeiling: null, windowCorrect: 0, windowTotal: 0 },
        where: { userLanguageSkill: { language, skill, userId } },
      }),
    ),
  );
}

/**
 * Ends the level test whenever the learner wants: the answers so far set a level for reading,
 * listening and writing, for speaking only when the learner said the sentence out loud, and one
 * for the goal, which the plan and every call use. Activity keeps refining them.
 */
export async function finishLanguageLevelTest(
  goalId: string,
): Promise<FinishLanguageLevelTestResult> {
  const context = await loadLevelTestContext(goalId);

  if (context.status !== "ready") {
    return context;
  }

  const { bank, owned, progress } = context;

  if (!bank) {
    return { status: "notReady" };
  }

  const { goal, userId } = owned;
  const scores = getLevelTestScores({ bank, progress, start: getTestStart(goal) });
  const labels = toLevelLabels(scores);

  await Promise.all([
    saveSkillLevels({ language: goal.targetLanguage, scores, userId }),
    prisma.goal.update({
      data: {
        details: {
          ...readGoalDetails(goal),
          level: formatCefrScore(getOverallScore(scores)),
          levelTest: progress,
          skillLevels: labels,
        },
      },
      where: { id: goal.id },
    }),
  ]);

  revalidateCacheTags([getGoalsCacheTag(userId), getUserProgressCacheTag(userId)]);

  await trackLearnerEvents({
    events: [
      {
        name: "Level Test Finished",
        properties: {
          answered: progress.answers.length + (progress.speaking ? 1 : 0),
          target_language: goal.targetLanguage,
        },
      },
    ],
    goalId: goal.id,
    userId,
  });

  return { levels: listLevelTestLevels(scores), status: "ready" };
}
