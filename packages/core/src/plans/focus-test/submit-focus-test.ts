import "server-only";
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
import { type ItemAnswerInput } from "../../learner/contract";
import { recordLearnerAnswer } from "../../learner/record-learner-answer";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { type ProgressCelebration } from "../../sessions/progress-celebration";
import { recordAnsweredActivity } from "../../stats/record-answered-activity";
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

/** Answers of one skill record one after another, so they never race on the same row. */
async function recordAnswers({
  graded,
  timeZone,
  userId,
}: {
  graded: readonly GradedAnswer[];
  timeZone: string;
  userId: string;
}): Promise<void> {
  const answeredAt = new Date();

  const record = ({ answer, isCorrect, item }: GradedAnswer) =>
    recordLearnerAnswer({
      answer: answer.answer,
      answeredAt,
      graded: { durationMs: answer.durationMs, isCorrect },
      itemId: item.id,
      language: item.language,
      purpose: "diagnostic",
      skillId: item.skillId,
      timeZone,
      userId,
    });

  await Promise.all(
    [...Map.groupBy(graded, (entry) => entry.item.skillId).values()].map((answers) =>
      answers.reduce<Promise<unknown>>(
        (previous, entry) => previous.then(() => record(entry)),
        Promise.resolve(),
      ),
    ),
  );
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
  await recordAnswers({ graded, timeZone, userId });

  const results = scoreFocusTest({
    answers: graded.map((entry) => ({
      area: entry.area,
      chance: getChance(entry.item),
      isCorrect: entry.isCorrect,
    })),
    areas: shape.areas,
  });

  const focusAreas = chooseFocusAreas(results);

  const change =
    focusAreas.length > 0
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

  const progress = await recordAnsweredActivity({
    answers: graded.map((entry) => ({
      durationMs: entry.answer.durationMs,
      isCorrect: entry.isCorrect,
    })),
    contentIds: toFocusTestContentIds({ ...said, requestId: input.requestId }),
    goalId,
    lessonKind: "focusTest",
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
    key: `focusTest:${userId}:${goalId}:${input.requestId}`,
    replay: () => replaySavedReceipt({ goalId, requestId: input.requestId, userId }),
    submit: () => submitOwnedFocusTest({ goal: owned.goal, input, userId }),
    userId,
  });
}
