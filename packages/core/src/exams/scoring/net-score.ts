export type NetOutcome = "blank" | "partial" | "right" | "wrong";

export type NetAnswer = {
  credit?: number;
  flagged: boolean;
  outcome: NetOutcome;
  wrongPenalty: number;
};

type NetScore = {
  blank: number;
  max: number;
  net: number;
  partial: number;
  penalty: number;
  right: number;
  wrong: number;
};

const MIN_UNSURE_ANSWERS = 4;

const NET_DECIMALS = 100;

function count(answers: readonly NetAnswer[], outcome: NetOutcome): number {
  return answers.filter((answer) => answer.outcome === outcome).length;
}

function sumPenalties(answers: readonly NetAnswer[]): number {
  return answers.reduce((sum, answer) => sum + answer.wrongPenalty, 0);
}

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
  const wrong = answers.filter((answer) => answer.outcome === "wrong");
  const partial = answers.filter((answer) => answer.outcome === "partial");
  const shares = partial.reduce((sum, answer) => sum + (answer.credit ?? 0), 0);
  const net = Math.round((right + shares - sumPenalties(wrong)) * NET_DECIMALS) / NET_DECIMALS;

  return {
    blank: count(answers, "blank"),
    max: answers.length,
    net,
    partial: partial.length,
    penalty,
    right,
    wrong: wrong.length,
  };
}

type CalibrationGroup = { answered: number; right: number };

type NetCalibration = {
  blankingGain: number;
  sure: CalibrationGroup;
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

export function getNetCalibration({
  answers,
  penalty,
}: {
  answers: readonly NetAnswer[];
  penalty: number;
}): NetCalibration {
  const flagged = answers.filter((answer) => answer.flagged);
  const sure = toGroup(answers.filter((answer) => !answer.flagged));
  const unsure = toGroup(flagged);

  const missed = flagged.filter(
    (answer) => answer.outcome !== "blank" && answer.outcome !== "right",
  );

  const blankingGain = Math.round((sumPenalties(missed) - unsure.right) * NET_DECIMALS);

  return {
    advice: getAdvice({ penalty, unsure }),
    blankingGain: blankingGain / NET_DECIMALS,
    sure,
    unsure,
  };
}

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
