import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CALIBRATION_REPEATS,
  type CalibrationAnswer,
  type CalibrationCohort,
  getKeysRevision,
  listCalibrationCohorts,
  readCalibrationKeys,
} from "@/tasks/grade-essay/calibration-cases";
import { getWritingGrader } from "@zoonk/ai/tasks/grading/grade-essay";
import { getWritingKeyWriter } from "@zoonk/ai/tasks/items/write-writing-prompt";
import {
  WRITING_PART_ERROR_RATE,
  type WeightedResidual,
  type WritingCalibration,
  type WritingGrader,
  rankWritingResiduals,
  writingCalibrationSchema,
} from "@zoonk/core/exams/essays/writing-calibration";
import { type WritingRowKind, writingRowKind } from "@zoonk/core/exams/essays/writing-contract";

const RESULT_DIRECTORY = "eval-results/written-calibration";
const OUTPUT = "../../packages/core/src/exams/essays/_utils/writing-calibration-data.json";
const ANALYSIS_CUTOFF_SHARE = 0.6;
const TAIL_COVERAGE = 1 - WRITING_PART_ERROR_RATE / 2;
const MIN_COHORT_FOR_WEAK_GATE = 5;
const MAX_WIDTH = 1 / 3;
const EPSILON = 1e-10;

type Range = { high: number; low: number };

type Run = CalibrationAnswer & {
  draw: number;
  estimated: Range | null;
  fingerprint: string;
  grader: WritingGrader | null;
  keysRevision?: string;
  kinds: WritingRowKind[];
  run: number;
  writer: WritingGrader;
};

type Residual = { over: number; under: number };
type MeasuredAnswer = CalibrationAnswer & { estimates: Range[]; residual: Residual };
type Fold = CalibrationCohort & { measured: MeasuredAnswer[] };

const sameRevision = (first: WritingGrader | null, second: WritingGrader) =>
  first?.model === second.model && first.promptVersion === second.promptVersion;

async function readRuns(directory: string): Promise<Run[]> {
  const directoryEntries = await readdir(directory);
  const paths = directoryEntries.filter((file) => file.endsWith(".jsonl"));
  const files = await Promise.all(paths.map((file) => readFile(join(directory, file), "utf8")));

  return files.flatMap((file) =>
    file
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Run),
  );
}

function measure(
  cohort: CalibrationCohort,
  runs: ReadonlyMap<string, Run[]>,
  provenance: Pick<WritingCalibration, "grader" | "writer" | "keysRevision">,
): Fold {
  const measured = cohort.answers.flatMap((answer): MeasuredAnswer[] => {
    const attempts = (runs.get(answer.answer) ?? []).filter(
      (run) =>
        run.source === answer.source &&
        sameRevision(run.grader, provenance.grader) &&
        (run.draw === 0 ||
          (run.keysRevision === provenance.keysRevision &&
            sameRevision(run.writer, provenance.writer))),
    );

    const estimates = cohort.draws.flatMap((draw) => {
      const matching = attempts.filter((attempt) => attempt.draw === draw);

      if (new Set(matching.map(({ fingerprint }) => fingerprint)).size !== 1) {
        return [];
      }

      return Array.from({ length: CALIBRATION_REPEATS }, (_, index) => {
        const repeats = matching.filter(({ run }) => run === index + 1);
        const entry = repeats[0];

        return repeats.length === 1 &&
          entry?.kinds.length === 1 &&
          entry.kinds[0] === cohort.kind &&
          entry.mark === answer.mark &&
          entry.max === answer.max &&
          entry.estimated &&
          entry.estimated.low >= 0 &&
          entry.estimated.high >= entry.estimated.low &&
          entry.estimated.high <= answer.max
          ? [entry.estimated]
          : [];
      }).flat();
    });

    if (estimates.length !== cohort.draws.length * CALIBRATION_REPEATS) {
      return [];
    }

    const { mark, max } = answer;

    return [
      {
        ...answer,
        estimates,
        residual: {
          over: Math.max(0, ...estimates.map(({ high }) => (high - mark) / max)),
          under: Math.max(0, ...estimates.map(({ low }) => (mark - low) / max)),
        },
      },
    ];
  });

  return { ...cohort, measured };
}

function residuals(folds: Fold[], side: keyof Residual): WeightedResidual[] {
  const available = folds.filter(({ measured }) => measured.length > 0);
  const count = available.reduce((sum, { measured }) => sum + measured.length, 0);

  // Every exam gets equal empirical mass. Reserve one pooled answer's mass for the unseen case.
  return available
    .flatMap(({ measured }) => {
      const weight = count / ((count + 1) * available.length * measured.length);
      return measured.map(({ residual }) => ({ share: residual[side], weight }));
    })
    .toSorted((a, b) => a.share - b.share);
}

function pointBar(answers: MeasuredAnswer[]) {
  const errors = answers
    .map(({ residual }) => Math.max(residual.over, residual.under))
    .toSorted((a, b) => a - b);

  const middle = Math.floor(errors.length / 2);

  const median =
    ((errors[middle] ?? Number.NaN) + (errors[Math.floor((errors.length - 1) / 2)] ?? Number.NaN)) /
    2;

  const within = errors.filter((error) => error <= 0.2 + EPSILON).length / errors.length;

  return { median, passes: median <= 0.1 + EPSILON && within >= 0.8, within };
}

function coverage(answers: MeasuredAnswer[], margin: number | null, side: keyof Residual) {
  return margin === null
    ? Number.NaN
    : answers.filter(({ residual }) => residual[side] <= margin + EPSILON).length / answers.length;
}

function binomialCdf(failures: number, trials: number, rate: number) {
  let probability = (1 - rate) ** trials;
  let cumulative = probability;

  for (let count = 1; count <= failures; count += 1) {
    probability *= ((trials - count + 1) * rate) / (count * (1 - rate));
    cumulative += probability;
  }

  return cumulative;
}

function upperErrorBound(wrong: number, adverse: number) {
  if (adverse === 0) {
    return Number.NaN;
  }

  if (wrong === adverse) {
    return 1;
  }

  let low = 0;
  let high = 1;

  // Invert the one-sided exact binomial test.
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const middle = (low + high) / 2;

    if (binomialCdf(wrong, adverse, middle) > 0.05) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return high;
}

function verdict(answers: MeasuredAnswer[], side: "above" | "below", margin: number | null) {
  let adverse = 0;
  let right = 0;
  let wrong = 0;

  for (const { cutoff, estimates, mark, max } of answers) {
    if (margin === null) {
      return { adverse: 0, passes: false, right: 0, upper: Number.NaN, wrong: 0 };
    }

    const threshold = (cutoff ?? ANALYSIS_CUTOFF_SHARE) * max;
    const truth = side === "above" ? mark >= threshold : mark < threshold;

    const calls = estimates.map(({ high, low }) =>
      side === "above"
        ? low - margin * max >= threshold - 1e-6
        : high + margin * max < threshold - 1e-6,
    );

    adverse += Number(!truth);
    wrong += Number(!truth && calls.some(Boolean));
    right += Number(truth && calls.every(Boolean));
  }

  const upper = upperErrorBound(wrong, adverse);
  return { adverse, passes: upper <= 0.1 && right > 0, right, upper, wrong };
}

const percent = (value: number | null) =>
  value === null || Number.isNaN(value) ? "—" : `${(value * 100).toFixed(1)}%`;

function foldResult(fold: Fold, training: Fold[]) {
  const { answers, measured } = fold;
  const weak = measured.filter(({ mark, max }) => mark < max / 2);
  const weakCount = answers.filter(({ mark, max }) => mark < max / 2).length;
  const all = pointBar(measured);
  const low = pointBar(weak);
  const over = rankWritingResiduals(residuals(training, "over"), TAIL_COVERAGE);
  const under = rankWritingResiduals(residuals(training, "under"), TAIL_COVERAGE);
  const overCoverage = coverage(measured, over, "over");
  const underCoverage = coverage(measured, under, "under");
  const above = verdict(measured, "above", over);
  const below = verdict(measured, "below", under);
  const complete = measured.length === answers.length;

  const points =
    complete &&
    all.passes &&
    (weakCount < MIN_COHORT_FOR_WEAK_GATE || low.passes) &&
    over !== null &&
    under !== null &&
    over + under <= MAX_WIDTH + EPSILON &&
    overCoverage >= TAIL_COVERAGE &&
    underCoverage >= TAIL_COVERAGE;

  return {
    above,
    all,
    below,
    complete,
    low,
    over,
    overCoverage,
    points,
    under,
    underCoverage,
    weak,
    weakCount,
  };
}

function displayVerdict({ adverse, right, upper, wrong }: ReturnType<typeof verdict>) {
  return adverse ? `${wrong}/${adverse} (upper ${percent(upper)}, right ${right})` : "—";
}

const [directory = RESULT_DIRECTORY, output = OUTPUT] = process.argv.slice(2);

const keys = await readCalibrationKeys(join(directory, "keys.json"));

const provenance = {
  grader: getWritingGrader(),
  keysRevision: getKeysRevision(keys),
  writer: getWritingKeyWriter(),
};

const runs = Map.groupBy(await readRuns(directory), ({ answer }) => answer);

const measured = listCalibrationCohorts().map((cohort) =>
  measure(cohort, runs, { ...provenance, keysRevision: getKeysRevision(keys, cohort.source) }),
);

const rows: WritingCalibration["rows"] = {};

const table = [
  "| Row kind | Held-out source | Complete / planned | Below half complete / planned | Median error / within 20% | Below-half median / within 20% | Over / under margin | Over / under coverage | Wrong above / adverse | Wrong below / adverse | Points fold |",
  "| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |",
];

for (const kind of writingRowKind.options) {
  const folds = measured.filter((fold) => fold.kind === kind);

  const results = folds.map((fold) => {
    const result = foldResult(
      fold,
      folds.filter(({ source }) => source !== fold.source),
    );

    const {
      above,
      all,
      below,
      complete,
      low,
      over,
      overCoverage,
      points,
      under,
      underCoverage,
      weak,
      weakCount,
    } = result;

    const failure = complete ? "fail" : "incomplete";

    table.push(
      `| ${kind} | ${fold.source} | ${fold.measured.length}/${fold.answers.length} | ${weak.length}/${weakCount} | ${percent(all.median)} / ${percent(all.within)} | ${percent(low.median)} / ${percent(low.within)} | ${percent(over)} / ${percent(under)} | ${percent(overCoverage)} / ${percent(underCoverage)} | ${displayVerdict(above)} | ${displayVerdict(below)} | ${points ? "pass" : failure} |`,
    );

    return result;
  });

  const points = results.length >= 2 && results.every((result) => result.points);

  rows[kind] = {
    points,
    residuals: { over: residuals(folds, "over"), under: residuals(folds, "under") },
    verdicts: {
      above: points && results.every(({ above }) => above.passes),
      below: points && results.every(({ below }) => below.passes),
    },
  };
}

const calibration = writingCalibrationSchema.parse({ ...provenance, rows });

const formatted = execFileSync("pnpm", ["exec", "oxfmt", "--stdin-filepath", output], {
  input: JSON.stringify(calibration, null, 2),
});

await writeFile(output, formatted);
process.stdout.write(`${table.join("\n")}\n`);
