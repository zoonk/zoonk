import "server-only";
import { type TestTurn } from "./focus-test-setup";

type Budget = {
  /** Questions may be asked now. */
  open: boolean;
  /** Fraction from 0 to 1. */
  spent: number;
  used: boolean;
};

/** An exam goal's sitting replaces the day's few minutes: it asks until its promised count. */
export function getAskingBudget(turn: TestTurn | null): Budget {
  if (turn) {
    const { sitting } = turn.progress;

    return {
      open: sitting !== null && sitting.left > 0,
      spent: sitting ? Math.min(1, sitting.answered / sitting.questions) : 0,
      used: sitting !== null && sitting.left <= 0,
    };
  }

  return { open: true, spent: 0, used: false };
}
