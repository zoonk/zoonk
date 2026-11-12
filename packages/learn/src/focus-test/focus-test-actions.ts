import { type FocusTestView } from "@zoonk/core/learner/placement/focus-test-contract";
import { type PlacementAnswer, type PlacementOutcome } from "../onboarding/onboarding-actions";

/** Failures come back as outcomes the screens can say, never thrown errors. */
export type FocusTestActions = {
  answer: (input: {
    answer: PlacementAnswer;
    durationMs: number;
    itemId: string;
  }) => Promise<PlacementOutcome>;
  /**
   * Closes the open sitting and applies every answer to the plan; with no answer yet it only skips
   * the test for now. Resolves the test as it stands after it, or null when it wasn't saved.
   */
  finish: () => Promise<{ focusTest: FocusTestView | null } | null>;
  get: () => Promise<PlacementOutcome>;
  /** Opens the next sitting; asked again, it returns the one already open. */
  start: () => Promise<PlacementOutcome>;
};
