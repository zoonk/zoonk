import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import {
  type PlacementAttemptView,
  type PlacementOutcome,
  type PlacementQuestion,
  type PlacementResult,
} from "../onboarding/onboarding-actions";
import { type PlacementQuestionWait } from "../onboarding/steps/use-placement-question-poll";
import { type PlacementLength, type PlacementPartOutcome } from "./placement-test-actions";

export type PlacementQuestionPhase = {
  attempt: PlacementAttemptView;
  failures: number;
  kind: "question";
  question: PlacementQuestion;
  trueFalseLabels: TrueFalseLabels;
};

type Finished = Extract<PlacementPartOutcome, { status: "finished" }>;

/** What a finish skipped. `changeId` is null when Undo wouldn't restore what the screen counts. */
type Skips = { changeId: string | null; heldUntilTomorrow: boolean; lessonsSkipped: number };

export type PlacementResultPhase = Skips & {
  attemptId: string;
  kind: "result";
  nextLesson: PlacementResult["nextLesson"];
};

export type PlacementTestPhase =
  | PlacementQuestionPhase
  /**
   * `retryLength`: the test couldn't start, or its questions couldn't be written, so the wait
   * offers "Try again", which starts it again.
   * `buildFailed`: the course itself is still being built and that stopped.
   */
  | (PlacementQuestionWait & { buildFailed?: true; retryLength?: PlacementLength })
  | { kind: "loadFailed" }
  | { kind: "loading" }
  | { kind: "offer" }
  | { kind: "unavailable" }
  /** The test asks nothing more and isn't closed yet: closing it is the next save. */
  | { attempt: PlacementAttemptView; kind: "partOver" }
  /** Back at a test that was stopped before its end. */
  | { attempt: PlacementAttemptView; kind: "continue" }
  | PlacementResultPhase;

const FAILED: PlacementOutcome = { status: "failed" };

/**
 * Where an answer leaves the test, or null when it didn't save. Core refuses an answer to a question
 * it no longer asks, such as one another device moved past, so a read says whether the test moved on:
 * a read that still asks the question means the answer didn't save.
 */
export async function answerOrRead({
  answer,
  question,
  read,
}: {
  answer: () => Promise<PlacementOutcome>;
  question: PlacementQuestion;
  read: () => Promise<PlacementOutcome>;
}): Promise<PlacementOutcome | null> {
  const answered = await answer().catch(() => FAILED);
  const now = answered.status === "failed" ? await read().catch(() => FAILED) : answered;
  const stillAsked = now.status === "ready" && now.next?.itemId === question.itemId;

  return now.status === "failed" || stillAsked ? null : now;
}

/** A test that's closed or was stopped: either way it asks nothing until it's started again. */
function isResting(attempt: PlacementAttemptView): boolean {
  return attempt.partComplete || attempt.resume !== null;
}

/** Undo restores one finish's lessons, so it shows only when they are all the screen counts. */
function undoableChange({
  changeId,
  counted,
  restored,
}: {
  changeId: string | null | undefined;
  counted: number;
  restored: number | undefined;
}): string | null {
  return changeId && restored === counted ? changeId : null;
}

function toSavedResult(result: PlacementResult): PlacementResultPhase {
  return {
    attemptId: result.attemptId,
    changeId: undoableChange({
      changeId: result.changeId,
      counted: result.lessonsSkipped,
      restored: result.partLessonsSkipped,
    }),
    heldUntilTomorrow: result.heldUntilTomorrow === true,
    kind: "result",
    lessonsSkipped: result.lessonsSkipped,
    nextLesson: result.nextLesson ?? null,
  };
}

function toRestingPhase({
  attempt,
  result,
}: {
  attempt: PlacementAttemptView;
  result: PlacementResult | null;
}): PlacementTestPhase {
  return attempt.length === "quick" && result
    ? toSavedResult(result)
    : { attempt, kind: "continue" };
}

/** With no test open, one the learner asked for waits for the course's questions; otherwise it's offered. */
function toUnopenedPhase({
  asked,
  outcome,
}: {
  asked: boolean;
  outcome: Exclude<PlacementOutcome, { status: "failed" }>;
}): PlacementTestPhase {
  if (!asked) {
    return { kind: "offer" };
  }

  if (outcome.status === "notReady") {
    return { kind: "waiting" };
  }

  return outcome.status === "generationFailed"
    ? { buildFailed: true, kind: "waiting" }
    : { kind: "unavailable" };
}

/**
 * Where a read of the test leaves the learner. A sitting goes on at its next question; a test that
 * ended shows its result. With nothing open, onboarding shows the result of the test it ran;
 * otherwise the test is offered, or waited for when the learner already `asked` for it.
 */
export function toPlacementTestPhase({
  asked = false,
  outcome,
  surface,
}: {
  asked?: boolean;
  outcome: PlacementOutcome;
  surface: "onboarding" | "plan";
}): PlacementTestPhase {
  if (outcome.status === "failed") {
    return { kind: "loadFailed" };
  }

  const attempt = ("attempt" in outcome && outcome.attempt) || null;
  const result = outcome.status === "ready" ? outcome.result : null;

  if (!attempt) {
    return surface === "onboarding" && result
      ? toSavedResult(result)
      : toUnopenedPhase({ asked, outcome });
  }

  if (isResting(attempt)) {
    return toRestingPhase({ attempt, result });
  }

  if (outcome.status === "generationFailed") {
    return { kind: "waiting", retryLength: attempt.length };
  }

  if (outcome.status === "unavailable") {
    return { kind: "unavailable" };
  }

  if (outcome.status !== "ready") {
    return { kind: "waiting" };
  }

  if (!outcome.next) {
    return { attempt, kind: "partOver" };
  }

  return {
    attempt,
    failures: 0,
    kind: "question",
    question: outcome.next,
    trueFalseLabels: outcome.trueFalseLabels,
  };
}

/** Where a finish leaves the learner: at the test's result. */
export function toFinishedPhase({
  attemptId,
  finished,
}: {
  attemptId: string;
  finished: Finished;
}): PlacementTestPhase {
  const { result } = finished;
  const lessonsSkipped = result?.lessonsSkipped ?? finished.lessonsSkipped;

  return {
    attemptId,
    changeId: undoableChange({
      changeId: finished.changeId,
      counted: lessonsSkipped,
      restored: finished.lessonsSkipped,
    }),
    heldUntilTomorrow: (result?.heldUntilTomorrow ?? finished.heldUntilTomorrow) === true,
    kind: "result",
    lessonsSkipped,
    nextLesson: result?.nextLesson ?? null,
  };
}
