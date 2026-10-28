import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal } from "@zoonk/db";
import { parseCefrScore } from "@zoonk/utils/cefr";
import { type OwnedGoal, findOwnedGoal } from "../../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
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

const DEFAULT_START = 1;

export type LevelTestGoal = { goal: Goal & { targetLanguage: string }; userId: string };

export type LevelTestContext =
  | {
      bank: LevelTestBank | null;
      bankStartedAt: Date | null;
      owned: LevelTestGoal;
      progress: LevelTestProgress;
      status: "ready";
    }
  | { status: "notFound" | "notLanguage" | "unauthorized" };

/** The starting level must not follow a level previously set by this same test. */
export function readLevelTestProgress(goal: Pick<Goal, "details">): LevelTestProgress {
  const details = readGoalDetails(goal);
  const parsed = levelTestProgressSchema.safeParse(details.levelTest);
  const stored = parsed.success ? parsed.data : levelTestProgressSchema.parse({});

  return { ...stored, start: stored.start ?? parseCefrScore(details.level) ?? DEFAULT_START };
}

/** Returns false if progress changed since `from`; callers must reload rather than overwrite it. */
export async function saveLevelTestProgress({
  from,
  goal,
  progress,
}: {
  from: LevelTestProgress;
  goal: Pick<Goal, "id" | "userId">;
  progress: LevelTestProgress;
}): Promise<boolean> {
  return writeLearnerChange({ userId: goal.userId }, async (tx) => {
    const current = await tx.goal.findUniqueOrThrow({ where: { id: goal.id } });

    if (!isDeepStrictEqual(readLevelTestProgress(current), from)) {
      return unchanged(false);
    }

    await tx.goal.update({
      data: { details: { ...readGoalDetails(current), levelTest: progress } },
      where: { id: goal.id },
    });

    return true;
  });
}

export async function loadLevelTestContext(
  goalId: string,
  knownOwned?: OwnedGoal,
): Promise<LevelTestContext> {
  const owned = knownOwned ?? (await findOwnedGoal(goalId));

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

  const { start } = progress;
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
