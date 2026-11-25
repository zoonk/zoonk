/** Split-conformal calibration of written grades against board marks, as shares of a question's points. */

export type Range = { low: number; high: number };

export type GradedAnswer = {
  id: string;
  stratum: string;
  sourceQuestion: string;
  kind: "real" | "ablation";
  max: number;
  board: Range;
  cutoffShare: number | null;
  runs: Range[];
};

type Residual = { over: number; under: number };

type Margins = { over: number; under: number } | null;

const round = (value: number) => Math.round(value * 10_000) / 10_000;

function getRunResidual({ board, max }: GradedAnswer, run: Range): Residual {
  if (run.high === 0 && board.low > 0) {
    return { over: 0, under: 1 };
  }

  return {
    over: round(Math.max(0, run.low - board.low) / max),
    under: round(Math.max(0, board.high - run.high) / max),
  };
}

export function getAnswerResidual(answer: GradedAnswer): Residual {
  const residuals = answer.runs.map((run) => getRunResidual(answer, run));

  return {
    over: Math.max(0, ...residuals.map(({ over }) => over)),
    under: Math.max(0, ...residuals.map(({ under }) => under)),
  };
}

function rankResidual(values: number[], level: number): number | null {
  const rank = Math.ceil((values.length + 1) * level - 1e-9);

  if (rank > values.length) {
    return null;
  }

  return values.toSorted((a, b) => a - b)[rank - 1] ?? null;
}

export function isRankable(count: number, level: number): boolean {
  return Math.ceil((count + 1) * level - 1e-9) <= count;
}

/** Strata too small to rank widen the margins to their largest residual, ablations included; nothing shifts them. */
export function getMargins(answers: GradedAnswer[], level: number): Margins {
  const real = answers
    .filter(({ kind }) => kind === "real")
    .map((answer) => getAnswerResidual(answer));

  const over = rankResidual(
    real.map((residual) => residual.over),
    level,
  );

  const under = rankResidual(
    real.map((residual) => residual.under),
    level,
  );

  if (over === null || under === null) {
    return null;
  }

  const floors = [...getStrata(answers).values()]
    .filter((stratum) => !isRankable(stratum.length, level))
    .map((stratum) => stratum.map((answer) => getAnswerResidual(answer)));

  return {
    over: Math.max(over, ...floors.flat().map((residual) => residual.over)),
    under: Math.max(under, ...floors.flat().map((residual) => residual.under)),
  };
}

type Call = "above" | "below" | "close" | "none";

function getCall(answer: GradedAnswer, run: Range, margins: Margins): Call {
  if (!margins || answer.cutoffShare === null) {
    return "none";
  }

  const cutoff = answer.cutoffShare * answer.max;

  if (run.low - margins.over * answer.max >= cutoff - 1e-9) {
    return "above";
  }

  if (run.high + margins.under * answer.max < cutoff - 1e-9) {
    return "below";
  }

  return "close";
}

export function isBelowCutoff({ board, cutoffShare, max }: GradedAnswer): boolean {
  return cutoffShare !== null && board.high < cutoffShare * max - 1e-9;
}

function getPointsError({ board, max }: GradedAnswer, run: Range): number {
  const midpoint = (run.low + run.high) / 2;
  return Math.max(0, board.low - midpoint, midpoint - board.high) / max;
}

function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length === 0) {
    return Number.NaN;
  }

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

const POINTS_GATE = { maxMedianError: 0.1, minWithin: 0.8, within: 0.2 };

export function getPointsGate(answers: GradedAnswer[]) {
  const errors = answers.flatMap((answer) => answer.runs.map((run) => getPointsError(answer, run)));
  const medianError = median(errors);

  const within =
    errors.filter((error) => error <= POINTS_GATE.within + 1e-9).length / errors.length;

  const meanSigned =
    answers
      .flatMap((answer) =>
        answer.runs.map(
          (run) =>
            ((run.low + run.high) / 2 - (answer.board.low + answer.board.high) / 2) / answer.max,
        ),
      )
      .reduce((sum, value) => sum + value, 0) / errors.length;

  return {
    meanSigned: round(meanSigned),
    medianError: round(medianError),
    passes: medianError <= POINTS_GATE.maxMedianError + 1e-9 && within >= POINTS_GATE.minWithin,
    runs: errors.length,
    within: round(within),
  };
}

export function getHeldOutCalls(answers: GradedAnswer[], level: number) {
  return answers
    .filter((answer) => isBelowCutoff(answer))
    .map((answer) => {
      const margins = getMargins(
        answers.filter(({ sourceQuestion }) => sourceQuestion !== answer.sourceQuestion),
        level,
      );

      return { answer, calls: answer.runs.map((run) => getCall(answer, run, margins)), margins };
    });
}

export function getStratumCoverage(answers: GradedAnswer[], level: number) {
  return [...getStrata(answers).entries()].map(([stratum, members]) => {
    const margins = getMargins(
      answers.filter((answer) => answer.stratum !== stratum),
      level,
    );

    if (!margins) {
      return { margins, over: null, stratum, under: null };
    }

    const residuals = members.map((answer) => getAnswerResidual(answer));

    return {
      margins,
      over: round(
        residuals.filter(({ over }) => over <= margins.over + 1e-9).length / residuals.length,
      ),
      stratum,
      under: round(
        residuals.filter(({ under }) => under <= margins.under + 1e-9).length / residuals.length,
      ),
    };
  });
}

export function getStrata(answers: GradedAnswer[]) {
  return Map.groupBy(answers, ({ stratum }) => stratum);
}
