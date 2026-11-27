import {
  type PlacementAnswer,
  type PlacementAttemptView,
  type PlacementOutcome,
  type PlacementResult,
} from "../onboarding/onboarding-actions";

export type PlacementLength = PlacementAttemptView["length"];

/**
 * A finish that saved: `lessonsSkipped` is what this finish skipped and `partLessonsSkipped` what
 * its part has skipped so far. `attempt` is the test while it has parts left, `result` the test's
 * result so far. `stale` when another device already closed the part or started a newer test.
 */
export type PlacementPartOutcome =
  | {
      attempt: PlacementAttemptView | null;
      changeId: string | null;
      heldUntilTomorrow?: true;
      lessonsSkipped: number;
      partLessonsSkipped: number;
      result: PlacementResult | null;
      status: "finished";
    }
  | { status: "failed" }
  | { status: "stale" };

/** Failures come back as outcomes the screens can say, never thrown errors. */
export type PlacementTestActions = {
  answer: (input: {
    answer: PlacementAnswer;
    attemptId: string;
    durationMs: number;
    itemId: string;
    part: number;
  }) => Promise<PlacementOutcome>;
  finish: (input: { attemptId: string; part: number }) => Promise<PlacementPartOutcome>;
  get: () => Promise<PlacementOutcome>;
  /**
   * Opens a test of this length, the open test's next part, or the part the learner stopped in.
   * `wholeCourse` on a short test goes on to the rest of the course. Asked again, it returns the
   * open sitting.
   */
  start: (length: PlacementLength) => Promise<PlacementOutcome>;
  undo: (changeId: string) => Promise<boolean>;
};
