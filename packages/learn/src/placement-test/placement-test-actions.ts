import {
  type PlacementAnswer,
  type PlacementOutcome,
  type PlacementResult,
} from "../onboarding/onboarding-actions";

/**
 * A finish that saved, with the test's result. `stale` when another device already closed the test
 * or started a newer one.
 */
export type PlacementFinishOutcome =
  | {
      changeId: string | null;
      heldUntilTomorrow?: true;
      lessonsSkipped: number;
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
  }) => Promise<PlacementOutcome>;
  /** `answered`: the answers a stop's question showed; a server that counts others refuses it. */
  finish: (input: { answered?: number; attemptId: string }) => Promise<PlacementFinishOutcome>;
  get: () => Promise<PlacementOutcome>;
  /** Opens the test. Asked again, it returns the open one. */
  start: () => Promise<PlacementOutcome>;
  undo: (changeId: string) => Promise<boolean>;
};
