import "server-only";
import { getPlacementBudgetSpent } from "../placement-budget";
import { type TestTurn } from "./focus-test-setup";
import { isPlacementAnswerOn } from "./placement-answers";
import { type loadEvidence } from "./placement-evidence";

type Budget = {
  /** Questions may be asked now. */
  open: boolean;
  /** Fraction from 0 to 1. */
  spent: number;
  used: boolean;
};

/** An exam goal's sitting replaces the day's few minutes: it asks until its promised count. */
export function getAskingBudget({
  attempts,
  today,
  turn,
}: {
  attempts: Awaited<ReturnType<typeof loadEvidence>>["attempts"];
  today: Date | null;
  turn: TestTurn | null;
}): Budget {
  if (turn) {
    const { sitting } = turn.progress;

    return {
      open: sitting !== null && sitting.left > 0,
      spent: sitting ? Math.min(1, sitting.answered / sitting.questions) : 0,
      used: sitting !== null && sitting.left <= 0,
    };
  }

  const spent =
    today === null
      ? 0
      : getPlacementBudgetSpent(
          attempts.filter((attempt) => isPlacementAnswerOn({ attempt, day: today })),
        );

  return { open: spent < 1, spent, used: spent >= 1 };
}
