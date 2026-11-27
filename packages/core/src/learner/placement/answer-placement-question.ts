import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { gradedTestAnswer, testEventContext, trackTestEvents } from "../../analytics/test-events";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getAskedItemFilter } from "../../library/items/item-field";
import { ITEM_IMAGE_INCLUDE } from "../../library/items/item-image";
import { createLearnerAttempt } from "../_utils/create-learner-attempt";
import { type loadPlacementPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../_utils/write-learner-change";
import {
  type LearnerAnswer,
  persistLearnerAnswer,
  publishLearnerAnswer,
} from "../record-learner-answer";
import { loadWritingSkillIds } from "../writing-skills";
import { finishPlacementAttempt } from "./_utils/finish-placement-attempt";
import { type PlacementState, loadPlacementWithSummary } from "./_utils/load-placement-state";
import { SITTING_ANSWER_FILTER } from "./_utils/placement-answers";
import { matchesAttempt, readPlacementAttempt } from "./_utils/placement-attempt-record";
import {
  type PlacementItem,
  gradePlacementAnswer,
  parsePlacementItem,
} from "./_utils/placement-items";
import { saveTestSummary } from "./_utils/test-sitting";
import { type FocusTestRecord, readFocusTestRecord } from "./focus-test-state";
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
}): Promise<(PlacementItem & { difficulty: number | null }) | null> {
  const item = await prisma.item.findFirst({
    include: ITEM_IMAGE_INCLUDE,
    where: {
      id: itemId,
      skill: libraryRowsVisibleTo(userId),
      ...getAskedItemFilter({ examBlueprintId }),
    },
  });

  const parsed = item ? parsePlacementItem(item) : null;
  return item && parsed ? { ...parsed, difficulty: item.difficulty } : null;
}

async function readCourseQuestionState({
  goalId,
  input,
  tx,
}: {
  goalId: string;
  input: LearnerAnswer;
  tx: Parameters<typeof loadPlacementPlan>[1];
}) {
  const { state } = await loadPlacementWithSummary({
    goalId,
    timeZone: input.timeZone,
    tx,
    userId: input.userId,
  });

  return state.next?.itemId === input.itemId ? state : null;
}

function answerEventContext({
  course,
  goal,
  sitting,
  sittingAnswers,
}: {
  course: PlacementState | null;
  goal: Goal;
  sitting: FocusTestRecord["sitting"] | undefined;
  sittingAnswers: number;
}) {
  if (course?.attempt) {
    const { id, part, questions } = course.attempt;

    return {
      ...testEventContext(goal, { attemptId: id, part, parts: 1, questions, test: "course" }),
      question_number: course.answered + 1,
    };
  }

  return sitting
    ? {
        ...testEventContext(goal, {
          attemptId: sitting.id,
          questions: sitting.questions,
          test: "focus",
        }),
        question_number: sittingAnswers + 1,
      }
    : null;
}

function countSittingAnswers(
  sitting: FocusTestRecord["sitting"] | undefined,
  userId: string,
  tx: TransactionClient,
) {
  return sitting
    ? tx.attempt.count({ where: { ...SITTING_ANSWER_FILTER, focusTestId: sitting.id, userId } })
    : 0;
}

function readStoredAnswer({
  attemptId,
  itemId,
  userId,
  tx,
}: {
  attemptId?: string;
  itemId: string;
  userId: string;
  tx: TransactionClient;
}) {
  return tx.attempt.findFirst({
    select: { isCorrect: true },
    where: {
      ...SITTING_ANSWER_FILTER,
      ...(attemptId ? { focusTestId: attemptId } : {}),
      itemId,
      userId,
    },
  });
}

async function recordPlacementAnswer({
  attemptId,
  goalId,
  input,
  part,
}: {
  attemptId?: string;
  goalId: string;
  input: LearnerAnswer & { itemId: string };
  part?: number;
}) {
  const { itemId, userId } = input;

  const saved = await writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
    const { attempt, result } = readPlacementAttempt(goal);
    const sitting = readFocusTestRecord(goal)?.sitting;
    const focusTestId = sitting?.id ?? null;

    if (goal.kind === "learn" && !attemptId) {
      return unchanged(null);
    }

    const finished = result !== null && result.attemptId === attemptId;

    if (!finished && !matchesAttempt({ attempt, attemptId, part })) {
      return unchanged(null);
    }

    const answered = await readStoredAnswer({ attemptId, itemId, tx, userId });

    if (answered) {
      return unchanged({ analytics: null, events: null, isCorrect: answered.isCorrect });
    }

    if (finished) {
      return unchanged(null);
    }

    const sittingAnswers = await countSittingAnswers(sitting, userId, tx);

    if (sitting && sittingAnswers >= sitting.questions) {
      return unchanged(null);
    }

    const course = attemptId ? await readCourseQuestionState({ goalId, input, tx }) : null;

    if (attempt && !course) {
      return unchanged(null);
    }

    const analytics = answerEventContext({ course, goal, sitting, sittingAnswers });

    if (attempt?.search) {
      await createLearnerAttempt({
        answeredAt: new Date(),
        input: {
          ...input,
          answer: { ...input.answer, courseSearch: true },
          focusTestId: attempt.id,
        },
        transaction: tx,
      });

      return { analytics, events: [], isCorrect: input.graded.isCorrect };
    }

    const { events } = await persistLearnerAnswer({
      input: {
        ...input,
        answer: attemptId ? { ...input.answer, placementPending: true } : input.answer,
        focusTestId: attemptId ?? focusTestId,
      },
      transaction: tx,
    });

    return { analytics, events, isCorrect: input.graded.isCorrect };
  });

  if (saved?.events) {
    publishLearnerAnswer({ events: saved.events, userId });
  }

  return saved
    ? { analytics: saved.analytics, isCorrect: saved.isCorrect, recorded: saved.events !== null }
    : null;
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

  const previous = readPlacementAttempt(owned.goal).attempt;

  const [item, written] = await Promise.all([
    findGoalItem({
      examBlueprintId: owned.goal.examBlueprintId,
      itemId: input.itemId,
      userId: owned.userId,
    }),
    previous?.search ? new Set<string>() : loadWritingSkillIds(goalId),
  ]);

  if (!item || written.has(item.skillId)) {
    return { status: "invalidItem" };
  }

  const graded = gradePlacementAnswer({ answer: input.answer, item });
  const { snapshot } = graded;
  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  if (previous && !previous.search && previous.id === input.attemptId) {
    await finishPlacementAttempt({
      attemptId: previous.id,
      goal: owned.goal,
      part: previous.part,
      timeZone,
    });

    const { state: placement } = await loadPlacementWithSummary({
      goalId,
      timeZone,
      userId: owned.userId,
    });

    return { isCorrect: graded.isCorrect, placement, status: "ready" };
  }

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
    ownLevel: getOwnLevel({ goal: owned.goal, level: input.level }),
    timeZone,
    today: getDateInTimeZone({ date: new Date(), timeZone }),
    userId: owned.userId,
  };

  const { state: placement } =
    owned.goal.kind === "exam" ? await saveTestSummary(read) : await loadPlacementWithSummary(read);

  if (recorded) {
    const test = owned.goal.kind === "exam" ? "focus" : "course";

    const properties = saved.analytics ?? {
      ...testEventContext(owned.goal, { questions: null, test }),
      question_number: placement.answered,
    };

    trackTestEvents(owned.goal, [
      {
        name: "Test Answered",
        properties: {
          ...properties,
          answer: gradedTestAnswer({ correct: isCorrect, unknown: "dontKnow" in input.answer }),
          difficulty: item.difficulty,
          duration_ms: input.durationMs,
          kind: test,
          skill_id: item.skillId,
        },
      },
    ]);
  }

  return { isCorrect, placement, status: "ready" };
}
