import { type PartialCreditRule } from "@zoonk/ai/tasks/v2/research/partial-credit";
import { type NetOutcome } from "./net-score";

/** A question's options and the learner's picks among them (see `gradeOptionPicks`). */
type Picks = { correct: number; options: number; right: number; wrong: number };

function isExact({ correct, right, wrong }: Picks): boolean {
  return correct > 0 && right === correct && wrong === 0;
}

/**
 * The share of a question's points picks earn, by how the exam scores a question that asks for
 * several options, as its notice states it (the `partialCredit` of its multi-pick format), never
 * by the exam's name:
 * - `allOrNothing`: only every right option and nothing else earns the question (the GRE); the
 *   rule when the notice doesn't say.
 * - `perRightPick`: each right option picked earns its share of the right options while no wrong
 *   one is picked; a wrong pick earns nothing (Gaokao's multi-select).
 * - `perOption`: each right option picked earns one option's share while no wrong one is picked,
 *   and all of them the whole question; a wrong pick is a wrong answer, which the exam's penalty
 *   applies to (JEE Advanced: +1 a right option, +4 all of them, -2 any wrong one).
 * - `plusMinus`: each right pick earns a share of the right options and each wrong pick takes one
 *   away, never below nothing (NCLEX's +/- scoring).
 */
const RULES: Record<PartialCreditRule, (picks: Picks) => number> = {
  allOrNothing: (picks) => (isExact(picks) ? 1 : 0),
  perOption: (picks) => {
    if (picks.wrong > 0 || picks.options === 0) {
      return 0;
    }

    return isExact(picks) ? 1 : picks.right / picks.options;
  },
  perRightPick: (picks) =>
    picks.wrong > 0 || picks.correct === 0 ? 0 : picks.right / picks.correct,
  plusMinus: (picks) =>
    picks.correct === 0 ? 0 : Math.max(0, picks.right - picks.wrong) / picks.correct,
};

/** The share of a question's points the picks earn under the rule, from 0 to 1. */
export function getPickCredit({ picks, rule }: { picks: Picks; rule: PartialCreditRule }): number {
  return Math.min(1, RULES[rule](picks));
}

/**
 * How an answered question went from the share of its points it earned: all of them is right,
 * some is partly right, none is wrong (which a wrong-answer penalty applies to).
 */
export function getPickOutcome({
  answered,
  credit,
}: {
  answered: boolean;
  credit: number;
}): NetOutcome {
  if (!answered) {
    return "blank";
  }

  if (credit >= 1) {
    return "right";
  }

  return credit > 0 ? "partial" : "wrong";
}
