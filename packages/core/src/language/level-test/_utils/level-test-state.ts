import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { parseCefrScore } from "@zoonk/utils/cefr";
import { findOwnedGoal } from "../../../learner/_utils/owned-goal";
import { readGoalDetails } from "../../_utils/language-goal";
import {
  LEVEL_TEST_PREPARING_SECONDS,
  type LanguageLevelTestView,
  type LevelTestBank,
  type LevelTestProgress,
  levelTestProgressSchema,
} from "../level-test-contract";
import {
  LEVEL_TEST_TOTAL,
  getLevelTestScores,
  getNextLevelTestStep,
  listLevelTestLevels,
} from "../level-test-rules";
import { type LevelTestBankState, loadLevelTestBank } from "./level-test-bank";

/** A learner who didn't say their level starts the test at A2, where most beginners with some study are. */
const DEFAULT_START = 1;

export type LevelTestGoal = { goal: Goal & { targetLanguage: string }; userId: string };

export type LevelTestContext =
  | {
      bank: LevelTestBank | null;
      /** When the run writing the pair's questions started, while they're being written. */
      bankStartedAt: Date | null;
      owned: LevelTestGoal;
      progress: LevelTestProgress;
      status: "ready";
    }
  | { status: "notFound" | "notLanguage" | "unauthorized" };

export function getTestStart(goal: Pick<Goal, "details">): number {
  return parseCefrScore(readGoalDetails(goal).level) ?? DEFAULT_START;
}

function readLevelTestProgress(goal: Pick<Goal, "details">): LevelTestProgress {
  const parsed = levelTestProgressSchema.safeParse(readGoalDetails(goal).levelTest);
  return parsed.success ? parsed.data : { answers: [], counted: 0, speaking: null };
}

/** Keeps the test's answers on the goal, next to what onboarding already stored. */
export async function saveLevelTestProgress({
  goal,
  progress,
}: {
  goal: Pick<Goal, "details" | "id">;
  progress: LevelTestProgress;
}) {
  await prisma.goal.update({
    data: { details: { ...readGoalDetails(goal), levelTest: progress } },
    where: { id: goal.id },
  });
}

/**
 * One of the learner's language goals with its test so far and the pair's questions, or since
 * when they're being written. Read-only: the questions are written by a workflow.
 */
export async function loadLevelTestContext(goalId: string): Promise<LevelTestContext> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  const { targetLanguage } = goal;

  if (goal.kind !== "language" || !targetLanguage) {
    return { status: "notLanguage" };
  }

  const state: LevelTestBankState = await loadLevelTestBank({
    language: goal.language,
    targetLanguage,
  });

  return {
    bank: state.status === "ready" ? state.bank : null,
    bankStartedAt: state.status === "preparing" ? state.startedAt : null,
    owned: { goal: { ...goal, targetLanguage }, userId },
    progress: readLevelTestProgress(goal),
    status: "ready",
  };
}

/** What the test screen shows next: a question without its answer, the sentence to say, or done. */
export function toLevelTestView({
  bank,
  bankStartedAt = null,
  goal,
  lastCorrect = null,
  progress,
}: {
  bank: LevelTestBank | null;
  bankStartedAt?: Date | null;
  goal: LevelTestGoal["goal"];
  lastCorrect?: boolean | null;
  progress: LevelTestProgress;
}): LanguageLevelTestView {
  if (!bank) {
    return {
      expectedSeconds: LEVEL_TEST_PREPARING_SECONDS,
      startedAt: bankStartedAt?.toISOString() ?? null,
      status: "preparing",
    };
  }

  const start = getTestStart(goal);
  const step = getNextLevelTestStep({ bank, progress, start });
  const scores = getLevelTestScores({ bank, progress, start });

  const next =
    step.kind === "question"
      ? {
          kind: "question" as const,
          question: {
            id: step.question.id,
            level: step.question.level,
            options: step.question.options,
            passage: step.question.passage,
            question: step.question.question,
            skill: step.question.skill,
          },
        }
      : step;

  return {
    answered: progress.answers.length + (progress.speaking ? 1 : 0),
    lastCorrect,
    levels: listLevelTestLevels(scores),
    next,
    status: "ready",
    targetLanguage: goal.targetLanguage,
    total: LEVEL_TEST_TOTAL,
  };
}
