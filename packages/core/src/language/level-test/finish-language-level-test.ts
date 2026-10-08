import "server-only";
import { type LanguageSkill, prisma } from "@zoonk/db";
import { formatCefrScore } from "@zoonk/utils/cefr";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { applyPlacement } from "../../learner/placement/_utils/apply-placement";
import { recordAnsweredActivity } from "../../stats/record-answered-activity";
import { readGoalDetails } from "../_utils/language-goal";
import { getTestStart, loadLevelTestContext } from "./_utils/level-test-state";
import { type LevelTestBank, type LevelTestProgress } from "./level-test-contract";
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
 * The test's answers not counted yet, as the learner's study time: their answering time, how many
 * they got right, in Activity and Statistics like a chapter's test-out. Ending the test again
 * counts only what they answered since.
 */
async function recordTestActivity({
  bank,
  goalId,
  progress,
  timeZone,
  userId,
}: {
  bank: LevelTestBank;
  goalId: string;
  progress: LevelTestProgress;
  timeZone: string;
  userId: string;
}) {
  const fresh = progress.answers.slice(progress.counted);

  if (fresh.length === 0) {
    return;
  }

  const rightAnswers = new Map(
    bank.questions.map((question) => [question.id, question.answerIndex]),
  );

  await recordAnsweredActivity({
    answers: fresh.map((answer) => ({
      durationMs: answer.durationMs,
      isCorrect: answer.answerIndex !== null && rightAnswers.get(answer.id) === answer.answerIndex,
    })),
    contentIds: {},
    goalId,
    lessonKind: "levelTest",
    timeZone,
    userId,
  });
}

/**
 * Ends the level test whenever the learner wants: the answers so far set a level for reading and
 * listening, for speaking only when the learner said the sentence out loud (writing waits for
 * lessons' typed answers), and one
 * for the goal, which the plan and every call use: the plan's units below it are tested out.
 * Activity keeps refining them. The time it took counts as study time.
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
  const timeZone = getAnswerTimeZone({ goal });
  const scores = getLevelTestScores({ bank, progress, start: getTestStart(goal) });
  const labels = toLevelLabels(scores);

  await Promise.all([
    saveSkillLevels({ language: goal.targetLanguage, scores, userId }),
    prisma.goal.update({
      data: {
        details: {
          ...readGoalDetails(goal),
          level: formatCefrScore(getOverallScore(scores)),
          levelTest: { ...progress, counted: progress.answers.length },
          skillLevels: labels,
        },
      },
      where: { id: goal.id },
    }),
    recordTestActivity({ bank, goalId: goal.id, progress, timeZone, userId }),
  ]);

  revalidateCacheTags([getGoalsCacheTag(userId), getUserProgressCacheTag(userId)]);

  // The plan starts at the level: units of a band below it are tested out with an undo. A plan
  // built after the test gets the same once it exists (`applyPlacementToNewPlan`).
  await applyPlacement({ goalId: goal.id, now: new Date(), timeZone, userId });

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
