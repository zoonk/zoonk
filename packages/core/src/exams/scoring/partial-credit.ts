import { type PartialCreditRule } from "@zoonk/ai/tasks/v2/research/partial-credit";
import { type NetOutcome } from "./net-score";

type Picks = { correct: number; options: number; right: number; wrong: number };

function isExact({ correct, right, wrong }: Picks): boolean {
  return correct > 0 && right === correct && wrong === 0;
}

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

export function getPickCredit({ picks, rule }: { picks: Picks; rule: PartialCreditRule }): number {
  return Math.min(1, RULES[rule](picks));
}

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
