import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import {
  type ChoiceItem,
  gradeChoiceAnswer,
  parseChoiceItem,
} from "../../learner/_utils/choice-items";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { withTestSubmissionClaim } from "../../learner/_utils/test-submission-claim";
import { writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type ItemAnswerInput } from "../../learner/contract";
import { persistLearnerAnswer, publishLearnerAnswer } from "../../learner/record-learner-answer";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { type ProgressChange } from "../../sessions/_utils/session-progress";
import { type ProgressCelebration } from "../../sessions/progress-celebration";
import { settleAnsweredActivity } from "../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { changeGoalPlan } from "../change-goal-plan";
import {
  type FocusTestReceipt,
  findFocusTestReceipt,
  toFocusTestContentIds,
} from "./_utils/focus-test-receipt";
import { loadFocusTestShape } from "./_utils/load-focus-test";
import { type FocusTestInput } from "./focus-test-contract";
import { type FocusTestArea, chooseFocusAreas, scoreFocusTest } from "./focus-test-rules";

type FocusTestOutcome = ProgressCelebration & {
  areas: {
    answers: boolean[];
    chosen: boolean;
    correct: number;
    label: string;
    name: string;
    total: number;
  }[];
  changeId: string | null;
  focusAreas: string[];
};

export type SubmitFocusTestResult =
  | { outcome: FocusTestOutcome; status: "ready" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

type GradedAnswer = { answer: ItemAnswerInput; area: string; isCorrect: boolean; item: ChoiceItem };

function getChance(item: ChoiceItem): number {
  return item.format === "trueFalse" ? 1 / 2 : 1 / Math.max(2, item.content.options.length);
}

function firstAnswerPerItem(answers: readonly ItemAnswerInput[]): ItemAnswerInput[] {
  return answers.filter(
    (answer, index) => answers.findIndex((other) => other.itemId === answer.itemId) === index,
  );
}

async function gradeAnswers({
  answers,
  areas,
}: {
  answers: readonly ItemAnswerInput[];
  areas: readonly FocusTestArea[];
}): Promise<GradedAnswer[] | null> {
  const rows = await prisma.item.findMany({
    where: { id: { in: answers.map((answer) => answer.itemId) } },
  });

  const graded = answers.map((answer) => {
    const row = rows.find((candidate) => candidate.id === answer.itemId);
    const item = row ? parseChoiceItem(row) : null;
    const area = item && areas.find((candidate) => candidate.skillIds.includes(item.skillId));

    return item && area
      ? {
          answer,
          area: area.name,
          isCorrect: gradeChoiceAnswer({ answer: answer.answer, item }).isCorrect,
          item,
        }
      : null;
  });

  return graded.every((entry) => entry !== null) ? graded : null;
}

/**
 * The answers, the time and Energy they count and the receipt commit together, so a send that fails
 * leaves nothing for its retry to count again.
 */
async function countFocusTest({
  goalId,
  graded,
  requestId,
  said,
  timeZone,
  userId,
}: {
  goalId: string;
  graded: readonly GradedAnswer[];
  requestId: string;
  said: FocusTestReceipt;
  timeZone: string;
  userId: string;
}): Promise<{ brainPower: ProgressChange; energy: ProgressChange }> {
  const answeredAt = new Date();

  const { events, progress } = await writeLearnerChange(
    { planInputs: true, userId },
    async (tx) => {
      const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });
      const persisted = [];

      const persist = ({ answer, isCorrect, item }: GradedAnswer) =>
        persistLearnerAnswer({
          input: {
            answer: answer.answer,
            answeredAt,
            graded: { durationMs: answer.durationMs, isCorrect },
            itemId: item.id,
            language: item.language,
            purpose: "diagnostic",
            skillId: item.skillId,
            timeZone,
            userId,
          },
          transaction: tx,
        });

      for (const entry of graded) {
        // oxlint-disable-next-line no-await-in-loop -- Queries sharing a transaction must finish before the next one starts.
        persisted.push(await persist(entry));
      }

      const settled = await settleAnsweredActivity(tx, {
        answers: graded.map(({ answer, isCorrect }) => ({
          durationMs: answer.durationMs,
          isCorrect,
        })),
        contentIds: toFocusTestContentIds({ ...said, requestId }),
        goalId,
        lessonKind: "focusTest",
        lock,
        timeZone,
        userId,
      });

      return { events: persisted.flatMap((entry) => entry.events), progress: settled };
    },
  );

  publishLearnerAnswer({ events, userId });
  return progress;
}

function toReadyResult({
  celebration,
  said,
}: {
  celebration: ProgressCelebration;
  said: FocusTestReceipt;
}): SubmitFocusTestResult {
  return {
    outcome: {
      ...celebration,
      areas: said.areas.map((area) => ({
        answers: area.answers,
        chosen: said.focusAreas.includes(area.name),
        correct: area.answers.filter(Boolean).length,
        label: area.label,
        name: area.name,
        total: area.answers.length,
      })),
      changeId: said.changeId,
      focusAreas: said.focusAreas,
    },
    status: "ready",
  };
}

/** Retries return their receipt even if the plan has changed since and grading would now refuse them. */
async function replaySavedReceipt({
  goalId,
  requestId,
  userId,
}: {
  goalId: string;
  requestId: string;
  userId: string;
}): Promise<SubmitFocusTestResult | null> {
  const sent = await findFocusTestReceipt({ goalId, requestId, userId });

  if (!sent) {
    return null;
  }

  const celebration = await celebrateProgress({ progress: null, userId });
  return toReadyResult({ celebration, said: sent });
}

async function submitOwnedFocusTest({
  goal,
  input,
  userId,
}: {
  goal: Goal;
  input: FocusTestInput;
  userId: string;
}): Promise<SubmitFocusTestResult> {
  const goalId = goal.id;
  const replayed = await replaySavedReceipt({ goalId, requestId: input.requestId, userId });

  if (replayed) {
    return replayed;
  }

  const shape = await loadFocusTestShape(goal);

  if (!shape) {
    return { status: "unavailable" };
  }

  const graded = await gradeAnswers({
    answers: firstAnswerPerItem(input.answers),
    areas: shape.areas,
  });

  if (!graded) {
    return { status: "invalidItem" };
  }

  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });

  const results = scoreFocusTest({
    answers: graded.map((entry) => ({
      area: entry.area,
      chance: getChance(entry.item),
      isCorrect: entry.isCorrect,
    })),
    areas: shape.areas,
  });

  const focusAreas = chooseFocusAreas(results);
  // A focus the plan already has, such as one an earlier try of this send set, needs no change.
  const refocuses = focusAreas.length > 0 && !isDeepStrictEqual(focusAreas, shape.focusAreas);

  const change = refocuses
    ? await changeGoalPlan({
        goalId,
        input: { operations: [{ areas: focusAreas, kind: "focusAreas" }], timeZone },
        saveFocusAnyway: true,
        trackAnalytics: false,
      })
    : null;

  const said = {
    areas: results.map(({ answers, label, name }) => ({ answers, label, name })),
    changeId: change?.status === "applied" ? (change.change?.id ?? null) : null,
    focusAreas,
  };

  const progress = await countFocusTest({
    goalId,
    graded,
    requestId: input.requestId,
    said,
    timeZone,
    userId,
  });

  revalidateCacheTags([getLearnerModelCacheTag(userId), getUserProgressCacheTag(userId)]);

  const celebration = await celebrateProgress({ progress, userId });
  return toReadyResult({ celebration, said });
}

/** Retrying a `requestId` returns its receipt without recording or celebrating again. */
export async function submitFocusTest({
  goalId,
  input,
}: {
  goalId: string;
  input: FocusTestInput;
}): Promise<SubmitFocusTestResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { userId } = owned;

  return withTestSubmissionClaim({
    key: `${userId}:${goalId}:focusTest:${input.requestId}`,
    replay: () => replaySavedReceipt({ goalId, requestId: input.requestId, userId }),
    submit: () => submitOwnedFocusTest({ goal: owned.goal, input, userId }),
    userId,
  });
}
