import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getAskedItemFilter } from "../../library/items/item-field";
import { ITEM_IMAGE_INCLUDE } from "../../library/items/item-image";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../_utils/write-learner-change";
import {
  type LearnerAnswer,
  persistLearnerAnswer,
  publishLearnerAnswer,
} from "../record-learner-answer";
import { loadWritingSkillIds } from "../writing-skills";
import { type PlacementState, loadPlacementWithSummary } from "./_utils/load-placement-state";
import { SITTING_ANSWER_FILTER } from "./_utils/placement-answers";
import { readPlacementAttempt } from "./_utils/placement-attempt-record";
import {
  type PlacementItem,
  gradePlacementAnswer,
  parsePlacementItem,
} from "./_utils/placement-items";
import { saveTestSummary } from "./_utils/test-sitting";
import { readFocusTestRecord } from "./focus-test-state";
import { type PlacementAnswerInput, getOwnLevel } from "./placement-contract";

export type PlacementAnswerResult =
  | { isCorrect: boolean; placement: PlacementState; status: "ready" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "unauthorized" };

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

async function canAnswerCourseQuestion({
  goalId,
  input,
  tx,
}: {
  goalId: string;
  input: LearnerAnswer;
  tx: Parameters<typeof loadPlacementPlan>[1];
}) {
  const plan = await loadPlacementPlan(goalId, tx);

  const { state } = await loadPlacementWithSummary({
    goalId,
    plan,
    timeZone: input.timeZone,
    tx,
    userId: input.userId,
  });

  return state.next?.itemId === input.itemId;
}

/**
 * A question placement asked outside a session is answered once: a repeated send, such as a retry
 * after a lost response, records and counts nothing again.
 */
async function recordPlacementAnswer({
  attemptId,
  goalId,
  input,
  part,
}: {
  attemptId?: string;
  goalId: string;
  input: LearnerAnswer;
  part?: number;
}): Promise<{ recorded: boolean; isCorrect: boolean } | null> {
  const { itemId, userId } = input;

  const saved = await writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
    const { attempt } = readPlacementAttempt(goal);
    const sitting = readFocusTestRecord(goal)?.sitting;
    const focusTestId = sitting?.id ?? null;

    if (
      attemptId &&
      (!attempt || attempt.id !== attemptId || attempt.partComplete || (part ?? 1) !== attempt.part)
    ) {
      return unchanged(null);
    }

    const answered = await tx.attempt.findFirst({
      select: { isCorrect: true },
      where: {
        ...SITTING_ANSWER_FILTER,
        ...(attemptId ? { focusTestId: attemptId } : {}),
        itemId,
        userId,
      },
    });

    if (answered) {
      return unchanged({ events: null, isCorrect: answered.isCorrect });
    }

    if (sitting) {
      const total = await tx.attempt.count({
        where: { ...SITTING_ANSWER_FILTER, focusTestId: sitting.id, userId },
      });

      if (total >= sitting.questions) {
        return unchanged(null);
      }
    }

    if (attempt && (!attemptId || !(await canAnswerCourseQuestion({ goalId, input, tx })))) {
      return unchanged(null);
    }

    const { events } = await persistLearnerAnswer({
      input: {
        ...input,
        answer: attemptId ? { ...input.answer, placementPending: true } : input.answer,
        focusTestId: attemptId ?? focusTestId,
      },
      transaction: tx,
    });

    return { events, isCorrect: input.graded.isCorrect };
  });

  if (saved?.events) {
    publishLearnerAnswer({ events: saved.events, userId });
  }

  return saved ? { isCorrect: saved.isCorrect, recorded: saved.events !== null } : null;
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

  const [plan, item, written] = await Promise.all([
    owned.goal.kind === "exam" ? null : loadPlacementPlan(goalId),
    findGoalItem({
      examBlueprintId: owned.goal.examBlueprintId,
      itemId: input.itemId,
      userId: owned.userId,
    }),
    loadWritingSkillIds(goalId),
  ]);

  if (!item || written.has(item.skillId)) {
    return { status: "invalidItem" };
  }

  const graded = gradePlacementAnswer({ answer: input.answer, item });
  const { snapshot } = graded;
  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  const saved = await recordPlacementAnswer({
    attemptId: input.attemptId,
    goalId,
    input: {
      answer: input.answer,
      graded: { durationMs: input.durationMs, isCorrect: graded.isCorrect },
      isPlacement: true,
      itemId: item.id,
      language: item.language,
      mistake: { questionText: snapshot.question, snapshot },
      purpose: "diagnostic",
      skillId: item.skillId,
      timeZone,
      userId: owned.userId,
    },
    part: input.part,
  });

  if (!saved) {
    return { status: "invalidItem" };
  }

  const { isCorrect, recorded } = saved;

  const read = {
    goalId,
    ignoreAttempt: !input.attemptId,
    ownLevel: getOwnLevel({ goal: owned.goal, level: input.level }),
    timeZone,
    today: getDateInTimeZone({ date: new Date(), timeZone }),
    userId: owned.userId,
  };

  const { state: placement } = plan
    ? await loadPlacementWithSummary({ ...read, plan })
    : await saveTestSummary(read);

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
