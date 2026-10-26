import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getItemAudienceFilter } from "../../library/items/item-field";
import { gradeChoiceAnswer } from "../_utils/choice-items";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { gradeTypedItemAnswer } from "../_utils/typed-grading";
import { type TypedItem } from "../_utils/typed-items";
import { recordLearnerAnswer } from "../record-learner-answer";
import { type PlacementState, loadPlacementState } from "./_utils/load-placement-state";
import { type PlacementItem, parsePlacementItem } from "./_utils/placement-items";
import { type PlacementAnswerInput, getOwnLevel } from "./placement-contract";

export type PlacementAnswerResult =
  | { isCorrect: boolean; placement: PlacementState; status: "ready" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "unauthorized" };

type PlacementAnswer = PlacementAnswerInput["answer"];

/**
 * Placement asks the goal's own questions, and only ones it can grade here. A question it asked
 * stays answerable when the plan changes under it (a re-plan swaps the lessons whose skills it was
 * asked on, or a notice read again rebuilds the skill graph): the answer is still evidence on its
 * skill. So a question on a skill the plan no longer has counts when placement could have asked
 * it: one the learner can see, and not another exam's.
 */
async function findGoalItem({
  examBlueprintId,
  itemId,
  userId,
}: {
  examBlueprintId: string | null;
  itemId: string;
  userId: string;
}): Promise<PlacementItem | null> {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      skill: libraryRowsVisibleTo(userId),
      ...getItemAudienceFilter({ examBlueprintId }),
    },
  });

  return item ? parsePlacementItem(item) : null;
}

/**
 * A typed answer, graded by `gradeTypedItemAnswer`. "I don't know yet" is never graded. Placement
 * asks each question once, so only a client answering one question over and over gets past the
 * day's model-graded answers, where only an accepted answer counts.
 */
async function gradeTyped({
  answer,
  item,
  practicedLanguage,
  userId,
}: {
  answer: PlacementAnswer;
  item: TypedItem;
  practicedLanguage: string | null;
  userId: string;
}): Promise<boolean | null> {
  if ("dontKnow" in answer) {
    return false;
  }

  if (!("text" in answer)) {
    return null;
  }

  const verdict = await gradeTypedItemAnswer({
    item,
    practicedLanguage,
    text: answer.text,
    userId,
  });

  return verdict.isCorrect;
}

/** Whether the answer is right, or null when its shape doesn't fit the question. */
function gradeAnswer({
  answer,
  item,
  practicedLanguage,
  userId,
}: {
  answer: PlacementAnswer;
  item: PlacementItem;
  practicedLanguage: string | null;
  userId: string;
}): Promise<boolean | null> | boolean | null {
  if (item.format === "typed") {
    return gradeTyped({ answer, item, practicedLanguage, userId });
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

  const [plan, item] = await Promise.all([
    loadPlacementPlan(goalId),
    findGoalItem({
      examBlueprintId: owned.goal.examBlueprintId,
      itemId: input.itemId,
      userId: owned.userId,
    }),
  ]);

  const isCorrect = item
    ? await gradeAnswer({
        answer: input.answer,
        item,
        practicedLanguage: owned.goal.targetLanguage,
        userId: owned.userId,
      })
    : null;

  if (!item || isCorrect === null) {
    return { status: "invalidItem" };
  }

  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  await recordLearnerAnswer({
    answer: input.answer,
    graded: { durationMs: input.durationMs, isCorrect },
    isPlacement: true,
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
