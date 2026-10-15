import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type LanguageSkill, type TransactionClient, prisma } from "@zoonk/db";
import { formatCefrScore } from "@zoonk/utils/cefr";
import { safeAsync } from "@zoonk/utils/error";
import { usesNonLatinScript } from "@zoonk/utils/languages";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { applyPlacement } from "../../learner/placement/_utils/apply-placement";
import { type ProgressLock } from "../../sessions/_utils/session-progress";
import { settleAnsweredActivity } from "../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { readGoalDetails } from "../_utils/language-goal";
import {
  getTestStart,
  loadLevelTestContext,
  readLevelTestProgress,
} from "./_utils/level-test-state";
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

class SkillLevelsAdmissionError extends Error {
  override name = "SkillLevelsAdmissionError";
  readonly reason: "unchanged" | "retry";

  constructor(reason: "unchanged" | "retry") {
    super(`Skill levels admission: ${reason}`);
    this.reason = reason;
  }
}

const MAX_SKILL_LEVEL_ATTEMPTS = 3;

type SaveSkillLevelsInput = { language: string; scores: LevelTestScores; userId: string };

async function readSkillLevelsChange(
  transaction: TransactionClient,
  { language, scores, userId }: SaveSkillLevelsInput,
) {
  const levels = listLevelTestLevels(scores);

  const existing = await transaction.languageSkillLevel.findMany({
    where: { language, skill: { in: levels.map(({ skill }) => skill) }, userId },
  });

  const changed = levels.some(({ score, skill }) => {
    const row = existing.find((level) => level.skill === skill);

    return (
      row?.score !== score ||
      row.startScore !== score ||
      row.windowCeiling !== null ||
      row.windowCorrect !== 0 ||
      row.windowTotal !== 0
    );
  });

  const reading = levels.find(({ skill }) => skill === "reading");
  const previousReading = existing.find(({ skill }) => skill === "reading");

  return {
    changed,
    planInputs:
      usesNonLatinScript(language) &&
      reading !== undefined &&
      reading.score !== (previousReading?.score ?? 0),
  };
}

/**
 * The test's levels become where each skill starts; a new test starts them over. A skill the test
 * gave no level (speaking, when the sentence was skipped) keeps what lessons showed, or starts
 * from the goal's level once the learner speaks.
 */
async function saveSkillLevels(input: SaveSkillLevelsInput, attempt = 1): Promise<void> {
  const { language, scores, userId } = input;

  const { error } = await safeAsync(() =>
    prisma.$transaction(async (transaction) => {
      const initial = await readSkillLevelsChange(transaction, input);

      if (!initial.changed) {
        return;
      }

      await markLearnerChanged(transaction, { planInputs: initial.planInputs, userId });
      const current = await readSkillLevelsChange(transaction, input);

      if (!current.changed) {
        throw new SkillLevelsAdmissionError("unchanged");
      }

      if (initial.planInputs !== current.planInputs) {
        throw new SkillLevelsAdmissionError("retry");
      }

      await Promise.all(
        listLevelTestLevels(scores).map(({ score, skill }) =>
          transaction.languageSkillLevel.upsert({
            create: { language, score, skill, startScore: score, userId },
            update: {
              score,
              startScore: score,
              windowCeiling: null,
              windowCorrect: 0,
              windowTotal: 0,
            },
            where: { userLanguageSkill: { language, skill, userId } },
          }),
        ),
      );
    }),
  );

  if (error instanceof SkillLevelsAdmissionError && error.reason === "unchanged") {
    return;
  }

  if (error instanceof SkillLevelsAdmissionError && attempt < MAX_SKILL_LEVEL_ATTEMPTS) {
    return saveSkillLevels(input, attempt + 1);
  }

  if (error) {
    throw error;
  }
}

/**
 * The test's answers not counted yet, as the learner's study time: their answering time, how many
 * they got right, in Activity and Statistics like a chapter's test-out. Ending the test again
 * counts only what they answered since.
 */
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

  const { bank, owned } = context;

  if (!bank) {
    return { status: "notReady" };
  }

  const { goal, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal });

  const { progress, scores } = await writeLearnerChange(
    { planInputs: true, userId },
    async (transaction) => {
      const lock = await getCompletionEnergyContext({ timeZone, transaction, userId });

      /** Re-read the saved answers after serialization so concurrent finishes cannot count twice. */
      await transaction.$queryRaw`
      SELECT id FROM goals WHERE id = ${goal.id}::uuid FOR UPDATE
    `;

      const current = await transaction.goal.findUniqueOrThrow({ where: { id: goal.id, userId } });

      const currentProgress = readLevelTestProgress(current);

      const currentScores = getLevelTestScores({
        bank,
        progress: currentProgress,
        start: getTestStart(current),
      });

      const details = {
        ...readGoalDetails(current),
        level: formatCefrScore(getOverallScore(currentScores)),
        levelTest: { ...currentProgress, counted: currentProgress.answers.length },
        skillLevels: toLevelLabels(currentScores),
      };

      const result = { progress: currentProgress, scores: currentScores };

      if (
        currentProgress.counted >= currentProgress.answers.length &&
        isDeepStrictEqual(details, readGoalDetails(current))
      ) {
        return unchanged(result);
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

      await transaction.goal.update({ data: { details }, where: { id: goal.id } });

      return result;
    },
  );

  /** Linking merges skill rows before progress; never hold progress while waiting for those rows. */
  await saveSkillLevels({ language: goal.targetLanguage, scores, userId });

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
