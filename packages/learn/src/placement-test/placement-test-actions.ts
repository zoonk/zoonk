import {
  type PlacementAnswer,
  type PlacementAttemptView,
  type PlacementOutcome,
  type PlacementResult,
} from "../onboarding/onboarding-actions";

export type PlacementLength = PlacementAttemptView["length"];

/**
 * A part that closed: what it skipped, and either the next part waiting (`attempt`) or the test's
 * `result`. `stale` when another device already closed it or started a newer test.
 */
export type PlacementPartOutcome =
  | {
      attempt: PlacementAttemptView | null;
      changeId: string | null;
      lessonsSkipped: number;
      /** The topic the plan goes on with; null when none is left. */
      nextTopic: string | null;
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
  /** Opens a test of this length, or the next part of the open one; asked again, it returns it. */
  start: (length: PlacementLength) => Promise<PlacementOutcome>;
  undo: (changeId: string) => Promise<boolean>;
};
