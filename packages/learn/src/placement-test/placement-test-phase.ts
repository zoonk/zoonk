import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import {
  type PlacementAttemptView,
  type PlacementOutcome,
  type PlacementQuestion,
} from "../onboarding/onboarding-actions";
import { type PlacementPartOutcome } from "./placement-test-actions";

export type PlacementQuestionPhase = {
  answered: number;
  attempt: PlacementAttemptView;
  failures: number;
  kind: "question";
  /** 0 to 1, of this part. */
  progress: number;
  question: PlacementQuestion;
  trueFalseLabels: TrueFalseLabels;
};

type Finished = Extract<PlacementPartOutcome, { status: "finished" }>;

export type PlacementTestPhase =
  | PlacementQuestionPhase
  /** `waiting`: the open test's questions are still being written. */
  | { kind: "choose" | "loadFailed" | "loading" | "waiting" }
  /** This part asks nothing more and isn't closed yet: closing it is the next save. */
  | { attempt: PlacementAttemptView; kind: "partOver" }
  /**
   * A whole-course test between two parts. `lessonsSkipped` is the part that just closed, or null
   * when the learner came back to a test whose part closed earlier.
   */
  | {
      attempt: PlacementAttemptView;
      changeId: string | null;
      heldUntilTomorrow?: true;
      kind: "between";
      lessonsSkipped: number | null;
    }
  | {
      attemptId: string;
      changeId: string | null;
      heldUntilTomorrow?: true;
      kind: "result";
      length: PlacementAttemptView["length"];
      lessonsSkipped: number;
      nextTopic: string | null;
    };

function readAttempt(outcome: PlacementOutcome): PlacementAttemptView | null {
  return outcome.status === "ready" || outcome.status === "notReady"
    ? (outcome.attempt ?? null)
    : null;
}

/**
 * Where a read of the test leaves the learner. With no test open, they choose how much to check;
 * an open one goes on where it stopped, after its questions are written.
 */
export function toPlacementTestPhase(outcome: PlacementOutcome): PlacementTestPhase {
  if (outcome.status === "failed") {
    return { kind: "loadFailed" };
  }

  const attempt = readAttempt(outcome);

  if (!attempt) {
    return { kind: "choose" };
  }

  if (attempt.partComplete) {
    return { attempt, changeId: null, kind: "between", lessonsSkipped: null };
  }

  if (outcome.status !== "ready") {
    return { kind: "waiting" };
  }

  if (!outcome.next) {
    return { attempt, kind: "partOver" };
  }

  return {
    answered: outcome.answered,
    attempt,
    failures: 0,
    kind: "question",
    progress: outcome.dayBudgetSpent,
    question: outcome.next,
    trueFalseLabels: outcome.trueFalseLabels,
  };
}

/** A closed part goes on to the next one when the test has more; otherwise it's the result. */
export function toFinishedPhase({
  attemptId,
  finished,
  length,
}: {
  attemptId: string;
  finished: Finished;
  length: PlacementAttemptView["length"];
}): PlacementTestPhase {
  if (finished.attempt) {
    return {
      attempt: finished.attempt,
      changeId: finished.changeId,
      ...(finished.heldUntilTomorrow && { heldUntilTomorrow: finished.heldUntilTomorrow }),
      kind: "between",
      lessonsSkipped: finished.lessonsSkipped,
    };
  }

  const heldUntilTomorrow = finished.result?.heldUntilTomorrow ?? finished.heldUntilTomorrow;

  return {
    attemptId,
    changeId: finished.changeId,
    ...(heldUntilTomorrow && { heldUntilTomorrow }),
    kind: "result",
    length,
    lessonsSkipped: finished.result?.lessonsSkipped ?? finished.lessonsSkipped,
    nextTopic: finished.nextTopic,
  };
}
