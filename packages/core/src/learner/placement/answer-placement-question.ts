import "server-only";
import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { matchTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { claimAssist } from "../../entitlements/claim-usage";
import { gradeChoiceAnswer } from "../_utils/choice-items";
import { type GoalPlan, loadGoalPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { recordLearnerAnswer } from "../record-learner-answer";
import { type PlacementState, loadPlacementState } from "./_utils/load-placement-state";
import { type PlacementItem, type TypedItem, parsePlacementItem } from "./_utils/placement-items";
import { type PlacementAnswerInput, getOwnLevel } from "./placement-contract";

export type PlacementAnswerResult =
  | { isCorrect: boolean; placement: PlacementState; status: "ready" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "unauthorized" };

type PlacementAnswer = PlacementAnswerInput["answer"];

/** Placement only asks the goal's own questions, and only ones it can grade here. */
async function findGoalItem({
  itemId,
  plan,
}: {
  itemId: string;
  plan: GoalPlan;
}): Promise<PlacementItem | null> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });

  if (!item || !plan.skills.some((skill) => skill.id === item.skillId)) {
    return null;
  }

  return parsePlacementItem(item);
}

/**
 * A typed answer: code settles an accepted answer, and a fast model grades the rest one key point
 * at a time. Only an answer that states every key point counts as right, so a vague one can't
 * skip a phase. "I don't know yet" is never graded.
 */
async function gradeTyped({
  answer,
  item,
  userId,
}: {
  answer: PlacementAnswer;
  item: TypedItem;
  userId: string;
}): Promise<boolean | null> {
  if ("dontKnow" in answer) {
    return false;
  }

  if (!("text" in answer)) {
    return null;
  }

  const { content } = item;

  const usage = await claimAssist();

  // Once the learner's small AI help is used up, only an accepted answer (or a typo of one) counts.
  if (usage.status !== "allowed") {
    return (
      matchTypedAnswer({ acceptedAnswers: content.acceptedAnswers ?? [], answer: answer.text })
        .kind !== "none"
    );
  }

  const { data } = await gradeTypedAnswer({
    acceptedAnswers: content.acceptedAnswers,
    analytics: { contentScope: "personal", distinctId: userId },
    answer: answer.text,
    keyPoints: content.keyPoints,
    language: item.language,
    question: content.context ? `${content.context}\n\n${content.question}` : content.question,
    sampleAnswer: content.sampleAnswer,
  });

  return data.isCorrect;
}

/** Whether the answer is right, or null when its shape doesn't fit the question. */
function gradeAnswer({
  answer,
  item,
  userId,
}: {
  answer: PlacementAnswer;
  item: PlacementItem;
  userId: string;
}): Promise<boolean | null> | boolean | null {
  if (item.format === "typed") {
    return gradeTyped({ answer, item, userId });
  }

  return "text" in answer ? null : gradeChoiceAnswer({ answer, item }).isCorrect;
}

/**
 * Grades one placement answer, records it as a diagnostic answer (it teaches the learner model
 * what the learner already knows, and never fills the mistakes notebook) and returns the updated
 * placement with the next question. "I don't know yet" is an answer too.
 */
export async function answerPlacementQuestion({
  goalId,
  input,
}: {
  goalId: string;
  input: PlacementAnswerInput;
}): Promise<PlacementAnswerResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const plan = await loadGoalPlan(goalId);
  const item = await findGoalItem({ itemId: input.itemId, plan });

  const isCorrect = item
    ? await gradeAnswer({ answer: input.answer, item, userId: owned.userId })
    : null;

  if (!item || isCorrect === null) {
    return { status: "invalidItem" };
  }

  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  await recordLearnerAnswer({
    answer: input.answer,
    graded: { durationMs: input.durationMs, isCorrect },
    itemId: item.id,
    language: item.language,
    purpose: "diagnostic",
    skillId: item.skillId,
    timeZone,
    userId: owned.userId,
  });

  const placement = await loadPlacementState({
    goalId,
    ownLevel: getOwnLevel({ goal: owned.goal, level: input.level }),
    plan,
    today: getDateInTimeZone({ date: new Date(), timeZone }),
    userId: owned.userId,
  });

  return { isCorrect, placement, status: "ready" };
}
