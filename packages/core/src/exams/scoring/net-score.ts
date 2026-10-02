/**
 * Cebraspe's scoring: each right answer is worth a point, each wrong one takes a point away and a
 * statement left blank is worth nothing. That makes leaving a statement blank a strategy: answering
 * pays only above even odds. Flagged answers are the ones the learner wasn't sure of, so comparing
 * them with the rest tracks calibration.
 */
export type NetOutcome = "blank" | "right" | "wrong";

export type NetAnswer = { flagged: boolean; outcome: NetOutcome };

type NetScore = { blank: number; max: number; net: number; right: number; wrong: number };

/** Answering pays above even odds: one wrong answer cancels one right answer. */
const NET_BREAK_EVEN = 0.5;

/** Below this many unsure answers, calibration advice would be noise. */
const MIN_UNSURE_ANSWERS = 4;

function count(answers: readonly NetAnswer[], outcome: NetOutcome): number {
  return answers.filter((answer) => answer.outcome === outcome).length;
}

export function getNetScore(answers: readonly NetAnswer[]): NetScore {
  const right = count(answers, "right");
  const wrong = count(answers, "wrong");

  return { blank: count(answers, "blank"), max: answers.length, net: right - wrong, right, wrong };
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

function getAdvice(unsure: CalibrationGroup): NetCalibration["advice"] {
  if (unsure.answered < MIN_UNSURE_ANSWERS) {
    return null;
  }

  return unsure.right / unsure.answered < NET_BREAK_EVEN ? "blankUnsure" : "keepAnswering";
}

/** How often the learner is right when sure and when not, and what that means for blanks. */
export function getNetCalibration(answers: readonly NetAnswer[]): NetCalibration {
  const sure = toGroup(answers.filter((answer) => !answer.flagged));
  const unsure = toGroup(answers.filter((answer) => answer.flagged));
  const unsureWrong = unsure.answered - unsure.right;

  return { advice: getAdvice(unsure), blankingGain: unsureWrong - unsure.right, sure, unsure };
}

/** Adds up calibration groups across mocks, so the tracking grows with every mock. */
export function sumCalibration(
  calibrations: readonly Pick<NetCalibration, "sure" | "unsure">[],
): Pick<NetCalibration, "advice" | "sure" | "unsure"> {
  const add = (key: "sure" | "unsure"): CalibrationGroup => ({
    answered: calibrations.reduce((sum, calibration) => sum + calibration[key].answered, 0),
    right: calibrations.reduce((sum, calibration) => sum + calibration[key].right, 0),
  });

  const unsure = add("unsure");

  return { advice: getAdvice(unsure), sure: add("sure"), unsure };
}
