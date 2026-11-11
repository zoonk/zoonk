import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getAskedItemFilter } from "../../library/items/item-field";
import { ITEM_IMAGE_INCLUDE } from "../../library/items/item-image";
import { gradeChoiceAnswer } from "../_utils/choice-items";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { gradeTypedItemAnswer } from "../_utils/typed-grading";
import { type TypedItem, toTypedSnapshot } from "../_utils/typed-items";
import { unchanged, writeLearnerChange } from "../_utils/write-learner-change";
import {
  type LearnerAnswer,
  persistLearnerAnswer,
  publishLearnerAnswer,
} from "../record-learner-answer";
import { type PlacementState, loadPlacementWithSummary } from "./_utils/load-placement-state";
import { type PlacementItem, parsePlacementItem } from "./_utils/placement-items";
import { saveTestSummary } from "./_utils/test-sitting";
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
    include: ITEM_IMAGE_INCLUDE,
    where: {
      id: itemId,
      skill: libraryRowsVisibleTo(userId),
      ...getAskedItemFilter({ examBlueprintId }),
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
}) {
  if ("dontKnow" in answer) {
    return { isCorrect: false, snapshot: toTypedSnapshot({ explanation: null, item, text: null }) };
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

  return {
    isCorrect: verdict.isCorrect,
    snapshot: toTypedSnapshot({ explanation: verdict.feedback, item, text: answer.text }),
  };
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
}) {
  if (item.format === "typed") {
    return gradeTyped({ answer, item, practicedLanguage, userId });
  }

  return "text" in answer ? null : gradeChoiceAnswer({ answer, item });
}

/**
 * A question placement asked outside a session is answered once: a repeated send, such as a retry
 * after a lost response, records and counts nothing again.
 */
async function recordPlacementAnswer(input: LearnerAnswer): Promise<boolean> {
  const { itemId, userId } = input;

  const events = await writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const answered = await tx.attempt.findFirst({
      select: { id: true },
      where: { isPlacement: true, itemId, stepId: null, studySessionId: null, userId },
    });

    if (answered) {
      return unchanged(null);
    }

    const { events: recorded } = await persistLearnerAnswer({ input, transaction: tx });
    return recorded;
  });

  if (events) {
    publishLearnerAnswer({ events, userId });
  }

  return events !== null;
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

  const graded = item
    ? await gradeAnswer({
        answer: input.answer,
        item,
        practicedLanguage: owned.goal.targetLanguage,
        userId: owned.userId,
      })
    : null;

  if (!item || graded === null) {
    return { status: "invalidItem" };
  }

  const { isCorrect, snapshot } = graded;
  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  const recorded = await recordPlacementAnswer({
    answer: input.answer,
    graded: { durationMs: input.durationMs, isCorrect },
    isPlacement: true,
    itemId: item.id,
    language: item.language,
    mistake: { questionText: snapshot.question, snapshot },
    purpose: "diagnostic",
    skillId: item.skillId,
    timeZone,
    userId: owned.userId,
  });

  const readPlacement = owned.goal.kind === "exam" ? saveTestSummary : loadPlacementWithSummary;

  const { state: placement } = await readPlacement({
    goalId,
    ownLevel: getOwnLevel({ goal: owned.goal, level: input.level }),
    plan,
    today: getDateInTimeZone({ date: new Date(), timeZone }),
    userId: owned.userId,
  });

  const answer = isCorrect ? "correct" : "incorrect";

  if (recorded) {
    after(() =>
      trackLearnerEvents({
        events: [
          {
            name: "Placement Answered",
            properties: {
              answer: "dontKnow" in input.answer ? "dont_know" : answer,
              duration_ms: input.durationMs,
              question_number: placement.answered,
              skill_id: item.skillId,
            },
          },
        ],
        goalId,
        userId: owned.userId,
      }),
    );
  }

  return { isCorrect, placement, status: "ready" };
}
