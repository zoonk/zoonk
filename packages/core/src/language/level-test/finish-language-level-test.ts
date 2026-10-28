import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type LanguageSkill, type LanguageSkillLevel, type TransactionClient } from "@zoonk/db";
import { formatCefrScore } from "@zoonk/utils/cefr";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type ProgressLock } from "../../sessions/_utils/session-progress";
import { settleAnsweredActivity } from "../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { readGoalDetails } from "../_utils/language-goal";
import { announceLevelTestPlacement, placeLevelTestResult } from "./_utils/level-test-placement";
import { loadLevelTestContext, readLevelTestProgress } from "./_utils/level-test-state";
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

function isFreshStart({ row, score }: { row?: LanguageSkillLevel; score: number }) {
  return (
    row?.score === score &&
    row.startScore === score &&
    row.windowCeiling === null &&
    row.windowCorrect === 0 &&
    row.windowTotal === 0
  );
}

async function saveSkillLevels(
  transaction: TransactionClient,
  { language, scores, userId }: { language: string; scores: LevelTestScores; userId: string },
) {
  const levels = listLevelTestLevels(scores);

  const existing = await transaction.languageSkillLevel.findMany({
    where: { language, skill: { in: levels.map(({ skill }) => skill) }, userId },
  });

  const restarted = levels.filter(
    ({ score, skill }) =>
      !isFreshStart({ row: existing.find((row) => row.skill === skill), score }),
  );

  await Promise.all(
    restarted.map(({ score, skill }) =>
      transaction.languageSkillLevel.upsert({
        create: { language, score, skill, startScore: score, userId },
        update: { score, startScore: score, windowCeiling: null, windowCorrect: 0, windowTotal: 0 },
        where: { userLanguageSkill: { language, skill, userId } },
      }),
    ),
  );
}

async function recordTestActivity({
  bank,
  goalId,
  lock,
  progress,
  timeZone,
  transaction,
  userId,
}: {
  bank: LevelTestBank;
  goalId: string;
  lock: ProgressLock;
  progress: LevelTestProgress;
  timeZone: string;
  transaction: TransactionClient;
  userId: string;
}) {
  const fresh = progress.answers.slice(progress.counted);

  if (fresh.length === 0) {
    return;
  }

  const rightAnswers = new Map(
    bank.questions.map((question) => [question.id, question.answerIndex]),
  );

  await settleAnsweredActivity(transaction, {
    answers: fresh.map((answer) => ({
      durationMs: answer.durationMs,
      isCorrect: answer.answerIndex !== null && rightAnswers.get(answer.id) === answer.answerIndex,
    })),
    contentIds: {},
    goalId,
    lessonKind: "levelTest",
    lock,
    timeZone,
    userId,
  });
}

/** Retrying the same answers preserves levels and completes any unfinished placement. */
export async function finishLanguageLevelTest(
  goalId: string,
): Promise<FinishLanguageLevelTestResult> {
  const context = await loadLevelTestContext(goalId);

  if (context.status !== "ready") {
    return context;
  }

  const { bank, owned } = context;

  if (!bank) {
    return { status: "notReady" };
  }

  const { goal, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal });

  const { newResult, progress, scores } = await writeLearnerChange(
    { planInputs: true, userId },
    async (transaction) => {
      const lock = await getCompletionEnergyContext({ timeZone, transaction, userId });

      /** Re-read the saved answers after serialization so concurrent finishes cannot count twice. */
      await transaction.$queryRaw`
      SELECT id FROM goals WHERE id = ${goal.id}::uuid FOR UPDATE
    `;

      const current = await transaction.goal.findUniqueOrThrow({ where: { id: goal.id, userId } });

      const currentProgress = readLevelTestProgress(current);
      const settled = currentProgress.counted >= currentProgress.answers.length;

      const currentScores = getLevelTestScores({
        bank,
        progress: currentProgress,
        start: currentProgress.start,
      });

      const details = {
        ...readGoalDetails(current),
        level: formatCefrScore(getOverallScore(currentScores)),
        levelTest: { ...currentProgress, counted: currentProgress.answers.length },
        skillLevels: toLevelLabels(currentScores),
      };

      const result = { progress: currentProgress, scores: currentScores };

      if (settled && isDeepStrictEqual(details, readGoalDetails(current))) {
        return unchanged({ ...result, newResult: false });
      }

      await recordTestActivity({
        bank,
        goalId: goal.id,
        lock,
        progress: currentProgress,
        timeZone,
        transaction,
        userId,
      });

      const placement = {
        pastBasicsAreas: [],
        unannounced: [],
        ...currentProgress.placement,
        placed: false,
      };

      await transaction.goal.update({
        data: { details: { ...details, levelTest: { ...details.levelTest, placement } } },
        where: { id: goal.id },
      });

      await saveSkillLevels(transaction, {
        language: goal.targetLanguage,
        scores: currentScores,
        userId,
      });

      return { ...result, newResult: true };
    },
  );

  if (newResult) {
    revalidateCacheTags([getGoalsCacheTag(userId), getUserProgressCacheTag(userId)]);
  }

  const placing = await placeLevelTestResult({ goalId: goal.id, timeZone, userId });

  if (placing?.placedNow) {
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
  }

  if (placing) {
    await announceLevelTestPlacement({
      goalId: goal.id,
      placement: placing.placement,
      timeZone,
      userId,
    });
  }

  return { levels: listLevelTestLevels(scores), status: "ready" };
}
