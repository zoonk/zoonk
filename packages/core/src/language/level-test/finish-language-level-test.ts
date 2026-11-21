import "server-only";
import { type LanguageSkill, type TransactionClient } from "@zoonk/db";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { owePlanStartLessons } from "../../follow-ups/owe-goal-lessons";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type ProgressLock } from "../../sessions/_utils/session-progress";
import { settleAnsweredActivity } from "../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { readGoalDetails } from "../_utils/language-goal";
import { getOverallLevel } from "../levels/skill-level-rules";
import {
  announceLevelTestPlacement,
  skipConfirmedLanguageLessons,
} from "./_utils/level-test-placement";
import {
  canWriteLevelTest,
  levelTestDetailsWithProgress,
  loadLevelTestContext,
  readLevelTestProgress,
} from "./_utils/level-test-state";
import { oweLevelTestNotice } from "./_utils/owe-level-test-notice";
import {
  type LevelTestBank,
  type LevelTestProgress,
  type LevelTestQuestion,
  type LevelTestResult,
} from "./level-test-contract";
import {
  type LevelTestScores,
  getAnswerVerdict,
  getBand,
  getConfirmedLevel,
  getLevelTestRanges,
  getLevelTestScores,
  getNextLevelTestStep,
  listLevelTestLevels,
  toLevelLabels,
} from "./level-test-rules";
import { readLevelTestAttempts } from "./read-level-test-summary";

export type FinishLanguageLevelTestResult =
  | {
      levels: { label: string; score: number; skill: LanguageSkill }[];
      result?: LevelTestResult;
      status: "ready";
    }
  | { status: "notFound" | "notLanguage" | "notReady" | "unauthorized" };

async function saveSkillLevels(
  transaction: TransactionClient,
  { language, scores, userId }: { language: string; scores: LevelTestScores; userId: string },
) {
  const levels = listLevelTestLevels(scores);

  await transaction.languageSkillLevel.createMany({
    data: levels.map(({ score, skill }) => ({ language, score, skill, startScore: score, userId })),
    skipDuplicates: true,
  });

  for (const { score, skill } of levels) {
    // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
    await transaction.languageSkillLevel.updateMany({
      data: { score, startScore: score },
      where: {
        language,
        raisedAt: null,
        score: { equals: transaction.languageSkillLevel.fields.startScore },
        skill,
        userId,
      },
    });
  }
}

function isAnsweredRight({
  answer,
  question,
}: {
  answer: LevelTestProgress["answers"][number];
  question?: LevelTestQuestion;
}): boolean | null {
  return question ? getAnswerVerdict({ answer, question }) === true : null;
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
  const asked = new Map(bank.questions.map((question) => [question.id, question]));
  const confirmations = new Set((bank.confirmations ?? []).map(({ id }) => id));
  const fresh = progress.answers.slice(progress.counted).filter((answer) => !answer.skipped);

  if (fresh.length === 0) {
    return;
  }

  await settleAnsweredActivity(transaction, {
    answers: fresh.map((answer) => ({
      durationMs: answer.durationMs,
      isCorrect: confirmations.has(answer.id)
        ? answer.correct === true
        : isAnsweredRight({ answer, question: asked.get(answer.id) }),
    })),
    contentIds: {},
    goalId,
    lessonKind: "levelTest",
    lock,
    timeZone,
    userId,
  });
}

async function recordLevelTestResult({
  bank,
  current,
  currentProgress,
  timeZone,
  transaction,
}: {
  bank: LevelTestBank;
  current: Parameters<typeof levelTestDetailsWithProgress>[0] & {
    id: string;
    targetLanguage: string;
    userId: string;
  };
  currentProgress: LevelTestProgress;
  timeZone: string;
  transaction: TransactionClient;
}) {
  const { id: goalId, userId } = current;
  const now = new Date();
  const input = { bank, progress: currentProgress, start: currentProgress.start };
  const scores = getLevelTestScores(input);
  const through = getConfirmedLevel(input);
  const lock = await getCompletionEnergyContext({ timeZone, transaction, userId });
  const unannounced = await skipConfirmedLanguageLessons({ goalId, now, through, tx: transaction });
  const { usedConfirmations } = readLevelTestAttempts(current);

  const result = {
    attemptId: currentProgress.attemptId ?? null,
    finishedAt: now.toISOString(),
    lessonsSkipped: unannounced.length,
    levelsSkipped:
      through && unannounced.length > 0 ? CEFR_LEVELS.slice(0, getBand(through) + 1) : [],
    ranges: getLevelTestRanges(input),
    ...(currentProgress.length === "wholeCourse" &&
      getNextLevelTestStep(input).kind === "done" && { wholeCourseReady: true as const }),
  };

  const saved = {
    ...currentProgress,
    counted: currentProgress.answers.length,
    placement: { pastBasicsAreas: [], placed: true, unannounced },
    result,
    scores,
  };

  const details = levelTestDetailsWithProgress(current, saved);
  const overall = getOverallLevel(listLevelTestLevels(scores).map(({ score }) => score));
  const countedIds = new Set(currentProgress.answers.map(({ id }) => id));

  await recordTestActivity({
    bank,
    goalId,
    lock,
    progress: currentProgress,
    timeZone,
    transaction,
    userId,
  });

  await transaction.goal.update({
    data: {
      details: {
        ...details,
        ...(overall && { level: overall }),
        levelTest: {
          ...details.levelTest,
          lastResult: result,
          usedConfirmations: [
            ...usedConfirmations,
            ...(bank.confirmations ?? [])
              .filter(({ id }) => countedIds.has(id))
              .map(({ id }) => id),
          ],
        },
        skillLevels: { ...readPreviousSkillLevels(current), ...toLevelLabels(scores) },
      },
    },
    where: { id: goalId },
  });

  await saveSkillLevels(transaction, { language: current.targetLanguage, scores, userId });
  await owePlanStartLessons({ db: transaction, goalId, userId });
  await oweLevelTestNotice({ db: transaction, goalId, unannounced, userId });
  return saved;
}

function readPreviousSkillLevels(goal: Parameters<typeof readGoalDetails>[0]) {
  const { skillLevels } = readGoalDetails(goal);
  return isJsonObject(skillLevels) ? skillLevels : {};
}

export async function finishLanguageLevelTest(
  goalId: string,
  attemptId?: string,
): Promise<FinishLanguageLevelTestResult> {
  const context = await loadLevelTestContext(goalId, attemptId);

  if (context.status !== "ready") {
    return context;
  }

  const { bank, owned } = context;

  if (!bank) {
    return { status: "notReady" };
  }

  const { goal, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal });

  const finished = await writeLearnerChange({ planInputs: true, userId }, async (transaction) => {
    const current = await transaction.goal.findUniqueOrThrow({ where: { id: goalId, userId } });
    const progress = readLevelTestProgress(current, attemptId);

    if (!progress) {
      return unchanged(null);
    }

    if (progress.result || progress.placement || !canWriteLevelTest(current, progress)) {
      return unchanged({ newResult: false, progress });
    }

    return {
      newResult: true,
      progress: await recordLevelTestResult({
        bank,
        current: { ...current, targetLanguage: goal.targetLanguage },
        currentProgress: progress,
        timeZone,
        transaction,
      }),
    };
  });

  if (!finished) {
    return { status: "notFound" };
  }

  const { newResult, progress } = finished;

  if (newResult) {
    revalidateCacheTags([
      getGoalsCacheTag(userId),
      getLearnerModelCacheTag(userId),
      getUserProgressCacheTag(userId),
    ]);

    await trackLearnerEvents({
      events: [
        {
          name: "Level Test Finished",
          properties: { answered: progress.answers.length, target_language: goal.targetLanguage },
        },
      ],
      goalId,
      userId,
    });
  }

  if (progress.placement) {
    await announceLevelTestPlacement({ attemptId, goal, placement: progress.placement, timeZone });
  }

  return {
    levels: listLevelTestLevels(progress.scores ?? {}),
    ...(progress.result && { result: progress.result }),
    status: "ready",
  };
}
