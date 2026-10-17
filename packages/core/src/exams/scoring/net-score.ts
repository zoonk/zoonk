/**
 * Scoring where a wrong answer costs points: each right answer is worth a point, each wrong one
 * takes the notice's share of a point away (`penalty`: 1 for Cebraspe, where a wrong answer cancels
 * a right one; 0.25 for JEE's and NEET's -1 against +4) and a question left blank is worth
 * nothing. That makes leaving it blank a strategy: answering pays only above the break-even (see
 * `getBreakEven`). A multi-pick question answered partly right earns its share of a point where
 * the notice gives partial credit (`partial`, see `getPickCredit`), and no penalty. Flagged answers
 * are the ones the learner wasn't sure of, so comparing them with the rest tracks calibration.
 */
export type NetOutcome = "blank" | "partial" | "right" | "wrong";

export type NetAnswer = {
  /** The share of a point a partly right answer earned; other outcomes ignore it. */
  credit?: number;
  flagged: boolean;
  outcome: NetOutcome;
};

type NetScore = {
  blank: number;
  max: number;
  net: number;
  /** Answers partly right, each earning its share of a point. */
  partial: number;
  /** The share of a right answer each wrong one takes away. */
  penalty: number;
  right: number;
  wrong: number;
};

/** Below this many unsure answers, calibration advice would be noise. */
const MIN_UNSURE_ANSWERS = 4;

/** Net scores keep two decimals: a quarter point lost reads as 0.25, never 0.2499. */
const NET_DECIMALS = 100;

function count(answers: readonly NetAnswer[], outcome: NetOutcome): number {
  return answers.filter((answer) => answer.outcome === outcome).length;
}

/**
 * The share of answers that must be right for answering to pay: penalty / (1 + penalty). Even odds
 * where a wrong answer cancels a right one, 20% where it costs a quarter, 25% at a third.
 */
export function getBreakEven(penalty: number): number {
  return penalty / (1 + penalty);
}

export function getNetScore({
  answers,
  penalty,
}: {
  answers: readonly NetAnswer[];
  penalty: number;
}): NetScore {
  const right = count(answers, "right");
  const wrong = count(answers, "wrong");
  const partial = answers.filter((answer) => answer.outcome === "partial");
  const shares = partial.reduce((sum, answer) => sum + (answer.credit ?? 0), 0);
  const net = Math.round((right + shares - penalty * wrong) * NET_DECIMALS) / NET_DECIMALS;

  return {
    blank: count(answers, "blank"),
    max: answers.length,
    net,
    partial: partial.length,
    penalty,
    right,
    wrong,
  };
}

type CalibrationGroup = { answered: number; right: number };

type NetCalibration = {
  /**
   * How the net score would change if every unsure answer had been left blank: positive means
   * blanking them would have helped.
   */
  blankingGain: number;
  sure: CalibrationGroup;
  /** "blankUnsure" when unsure answers lose points, "keepAnswering" when they earn them. */
  advice: "blankUnsure" | "keepAnswering" | null;
  unsure: CalibrationGroup;
};

function toGroup(answers: readonly NetAnswer[]): CalibrationGroup {
  const answered = answers.filter((answer) => answer.outcome !== "blank");
  return { answered: answered.length, right: count(answered, "right") };
}

function getAdvice({
  penalty,
  unsure,
}: {
  penalty: number;
  unsure: CalibrationGroup;
}): NetCalibration["advice"] {
  if (unsure.answered < MIN_UNSURE_ANSWERS) {
    return null;
  }

  return unsure.right / unsure.answered < getBreakEven(penalty) ? "blankUnsure" : "keepAnswering";
}

/** How often the learner is right when sure and when not, and what that means for blanks. */
export function getNetCalibration({
  answers,
  penalty,
}: {
  answers: readonly NetAnswer[];
  penalty: number;
}): NetCalibration {
  const sure = toGroup(answers.filter((answer) => !answer.flagged));
  const unsure = toGroup(answers.filter((answer) => answer.flagged));
  const unsureWrong = unsure.answered - unsure.right;
  const blankingGain = Math.round((penalty * unsureWrong - unsure.right) * NET_DECIMALS);

  return {
    advice: getAdvice({ penalty, unsure }),
    blankingGain: blankingGain / NET_DECIMALS,
    sure,
    unsure,
  };
}

/** Adds up calibration groups across mocks, so the tracking grows with every mock. */
export function sumCalibration({
  calibrations,
  penalty,
}: {
  calibrations: readonly Pick<NetCalibration, "sure" | "unsure">[];
  penalty: number;
}): Pick<NetCalibration, "advice" | "sure" | "unsure"> {
  const add = (key: "sure" | "unsure"): CalibrationGroup => ({
    answered: calibrations.reduce((sum, calibration) => sum + calibration[key].answered, 0),
    right: calibrations.reduce((sum, calibration) => sum + calibration[key].right, 0),
  });

  const unsure = add("unsure");

  return { advice: getAdvice({ penalty, unsure }), sure: add("sure"), unsure };
}
