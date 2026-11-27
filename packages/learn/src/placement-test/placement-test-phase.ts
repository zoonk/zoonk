import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import {
  type PlacementAttemptView,
  type PlacementOutcome,
  type PlacementQuestion,
  type PlacementResult,
} from "../onboarding/onboarding-actions";
import { type PlacementQuestionWait } from "../onboarding/steps/use-placement-question-poll";
import { type PlacementFinishOutcome } from "./placement-test-actions";

export type PlacementQuestionPhase = {
  attempt: PlacementAttemptView;
  failures: number;
  kind: "question";
  question: PlacementQuestion;
  trueFalseLabels: TrueFalseLabels;
};

type Finished = Extract<PlacementFinishOutcome, { status: "finished" }>;

/**
 * Where the test starts the learner. `course` draws the course's line and is null when the result
 * exists before the plan does; `changeId` is null when nothing was skipped, so there is no Undo.
 */
export type PlacementResultPhase = Pick<PlacementResult, "chapter" | "course" | "nextLesson"> & {
  attemptId: string;
  changeId: string | null;
  heldUntilTomorrow: boolean;
  kind: "result";
  lessonsSkipped: number;
};

export type PlacementTestPhase =
  | PlacementQuestionPhase
  /**
   * `retry`: the test couldn't start, or its questions couldn't be written, so the wait offers "Try
   * again", which starts it again. `buildFailed`: the course itself is still being built and that
   * stopped.
   */
  | (PlacementQuestionWait & { buildFailed?: true; retry?: true })
  | { kind: "loadFailed" }
  | { kind: "loading" }
  | { kind: "offer" }
  | { kind: "unavailable" }
  /** The test asks nothing more and isn't closed yet: closing it is the next save. */
  | { attempt: PlacementAttemptView; kind: "over" }
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

function toResultPhase({
  changeId,
  heldUntilTomorrow,
  result,
}: {
  changeId: string | null | undefined;
  heldUntilTomorrow: boolean;
  result: PlacementResult;
}): PlacementResultPhase {
  return {
    attemptId: result.attemptId,
    changeId: result.lessonsSkipped > 0 ? (changeId ?? null) : null,
    chapter: result.chapter,
    course: result.course,
    heldUntilTomorrow,
    kind: "result",
    lessonsSkipped: result.lessonsSkipped,
    nextLesson: result.nextLesson,
  };
}

function toUnopenedPhase({
  asked,
  canStart,
  outcome,
}: {
  asked: boolean;
  canStart: boolean;
  outcome: Exclude<PlacementOutcome, { status: "failed" }>;
}): PlacementTestPhase {
  if (!asked) {
    return canStart ? { kind: "offer" } : { kind: "unavailable" };
  }

  if (outcome.status === "notReady") {
    return { kind: "waiting" };
  }

  return outcome.status === "generationFailed"
    ? { buildFailed: true, kind: "waiting" }
    : { kind: "unavailable" };
}

/**
 * `asked`: the learner already chose the test, so it's waited for instead of offered again.
 * `canStart`: false when the course has nothing a test could skip, so the Plan offers no start.
 */
export function toPlacementTestPhase({
  asked = false,
  canStart = true,
  outcome,
  surface,
}: {
  asked?: boolean;
  canStart?: boolean;
  outcome: PlacementOutcome;
  surface: "onboarding" | "plan";
}): PlacementTestPhase {
  if (outcome.status === "failed") {
    return { kind: "loadFailed" };
  }

  const attempt = ("attempt" in outcome && outcome.attempt) || null;
  const result = ("result" in outcome && outcome.result) || null;

  if (!attempt) {
    return surface === "onboarding" && result
      ? toResultPhase({
          changeId: result.changeId,
          heldUntilTomorrow: result.heldUntilTomorrow === true,
          result,
        })
      : toUnopenedPhase({ asked, canStart, outcome });
  }

  if (outcome.status === "generationFailed") {
    return { kind: "waiting", retry: true };
  }

  if (outcome.status === "unavailable") {
    return { kind: "unavailable" };
  }

  if (outcome.status !== "ready") {
    return { kind: "waiting" };
  }

  if (!outcome.next) {
    return { attempt, kind: "over" };
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
}): PlacementResultPhase {
  const heldUntilTomorrow =
    (finished.result?.heldUntilTomorrow ?? finished.heldUntilTomorrow) === true;

  if (finished.result) {
    return toResultPhase({
      changeId: finished.changeId,
      heldUntilTomorrow,
      result: finished.result,
    });
  }

  return {
    attemptId,
    changeId: finished.lessonsSkipped > 0 ? finished.changeId : null,
    chapter: null,
    course: null,
    heldUntilTomorrow,
    kind: "result",
    lessonsSkipped: finished.lessonsSkipped,
    nextLesson: null,
  };
}
