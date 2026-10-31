import { getAnswerPoints } from "./mock-points";

export type NetOutcome = "blank" | "partial" | "right" | "wrong";

export type NetAnswer = {
  credit?: number;
  flagged: boolean;
  outcome: NetOutcome;
  points: number;
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

export function getCalibrationAdvice({
  blankingGain,
  unsure,
}: {
  blankingGain: number;
  unsure: CalibrationGroup;
}): NetCalibration["advice"] {
  if (unsure.answered < MIN_UNSURE_ANSWERS) {
    return null;
  }

  return blankingGain > 0 ? "blankUnsure" : "keepAnswering";
}

export function getNetCalibration({ answers }: { answers: readonly NetAnswer[] }): NetCalibration {
  const flagged = answers.filter((answer) => answer.flagged);
  const sure = toGroup(answers.filter((answer) => !answer.flagged));
  const unsure = toGroup(flagged);

  const gain = flagged.reduce(
    (sum, answer) =>
      sum -
      getAnswerPoints({
        credit: answer.outcome === "right" ? 1 : (answer.credit ?? 0),
        marking: { part: null, points: answer.points, wrongPenalty: answer.wrongPenalty },
        outcome: answer.outcome,
      }),
    0,
  );

  const blankingGain = Math.round(gain * NET_DECIMALS);

  return {
    advice: getCalibrationAdvice({ blankingGain, unsure }),
    blankingGain: blankingGain / NET_DECIMALS,
    sure,
    unsure,
  };
}
