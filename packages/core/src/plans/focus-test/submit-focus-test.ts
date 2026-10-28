import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import {
  type ChoiceItem,
  gradeChoiceAnswer,
  parseChoiceItem,
} from "../../learner/_utils/choice-items";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type ItemAnswerInput } from "../../learner/contract";
import { recordLearnerAnswer } from "../../learner/record-learner-answer";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { type ProgressCelebration } from "../../sessions/progress-celebration";
import { recordAnsweredActivity } from "../../stats/record-answered-activity";
import { changeGoalPlan } from "../change-goal-plan";
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

  const shape = await loadFocusTestShape(owned.goal);

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

  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });
  await recordAnswers({ graded, timeZone, userId: owned.userId });

  const progress = await recordAnsweredActivity({
    answers: graded.map((entry) => ({
      durationMs: entry.answer.durationMs,
      isCorrect: entry.isCorrect,
    })),
    contentIds: {},
    goalId,
    lessonKind: "focusTest",
    timeZone,
    userId: owned.userId,
  });

  revalidateCacheTags([
    getLearnerModelCacheTag(owned.userId),
    getUserProgressCacheTag(owned.userId),
  ]);

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
        })
      : null;

  const celebration = await celebrateProgress({ progress, userId: owned.userId });

  return {
    outcome: {
      ...celebration,
      areas: results.map((result) => ({
        answers: result.answers,
        chosen: focusAreas.includes(result.name),
        correct: result.correct,
        label: result.label,
        name: result.name,
        total: result.total,
      })),
      changeId: change?.status === "applied" ? (change.change?.id ?? null) : null,
      focusAreas,
    },
    status: "ready",
  };
}
