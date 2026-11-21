import { type Goal } from "@zoonk/db";
import { CEFR_LEVELS, parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { readPlacementAttempt } from "../../learner/placement/_utils/placement-attempt-record";
import {
  levelTestOutLevelSchema,
  levelTestProgressSchema,
  levelTestResultSchema,
} from "./level-test-contract";
import { levelTestOutProgressSchema } from "./level-test-out-contract";

const attemptStateSchema = z.object({
  attempt: levelTestProgressSchema.optional(),
  completedAttempt: levelTestProgressSchema.optional(),
  lastResult: levelTestResultSchema.optional(),
  testOut: levelTestOutProgressSchema.optional(),
  usedConfirmations: z.array(z.string()).default([]),
});

export function readLevelTestDetails(goal: Pick<Goal, "details">) {
  const test = isJsonObject(goal.details) ? goal.details.levelTest : null;
  return isJsonObject(test) ? test : {};
}

export function readLevelTestAttempts(goal: Pick<Goal, "details">) {
  return attemptStateSchema.safeParse(readLevelTestDetails(goal)).data ?? { usedConfirmations: [] };
}

export function hasOpenLanguageTopicWalk(goal: Pick<Goal, "details">): boolean {
  return readPlacementAttempt(goal).attempt !== null;
}

function readOpenAttempt({ attempt, testOut }: ReturnType<typeof readLevelTestAttempts>) {
  if (attempt?.attemptId && !attempt.result) {
    return {
      id: attempt.attemptId,
      length: attempt.length ?? "quick",
      testOutLevel: attempt.testOutLevel,
    };
  }

  return testOut && !testOut.result && (testOut.preparingUntil || testOut.questions.length > 0)
    ? { id: testOut.id, length: "quick" as const, testOutLevel: testOut.level }
    : null;
}

export function readLevelTestSummary(goal: Pick<Goal, "details">) {
  const progress = readLevelTestAttempts(goal);
  const { lastResult } = progress;
  const details = isJsonObject(goal.details) ? goal.details : {};
  const score = parseCefrScore(details.level === "advanced" ? "B2" : details.level);
  const skipped = lastResult?.levelsSkipped ?? [];
  const current = score === null ? null : Math.floor(score);
  const highestKnown = Math.max(
    current ?? -1,
    ...skipped.map((level) => CEFR_LEVELS.indexOf(level)),
  );

  const nextTestOutLevel =
    current === null
      ? null
      : levelTestOutLevelSchema.options.find((level) => {
          const index = CEFR_LEVELS.indexOf(level);
          return index >= current && index <= highestKnown + 1 && !skipped.includes(level);
        });

  return {
    attempt: readOpenAttempt(progress),
    nextTestOutLevel: nextTestOutLevel ?? null,
    result: lastResult ?? null,
  };
}
