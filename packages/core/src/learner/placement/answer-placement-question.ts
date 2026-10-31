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

/** A question already asked stays answerable after re-planning removes its skill, provided it remains visible and exam-eligible. */
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

/** Records diagnostics without adding notebook mistakes; dontKnow is a valid answer. */
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
