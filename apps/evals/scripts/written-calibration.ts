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
  type WeightedResidual,
  type WritingCalibration,
  type WritingGrader,
  getWritingMargin,
  writingCalibrationSchema,
} from "@zoonk/core/exams/essays/writing-calibration";
import { type WritingRowKind, writingRowKind } from "@zoonk/core/exams/essays/writing-contract";

const RESULT_DIRECTORY = "eval-results/written-calibration";
const OUTPUT = "../../packages/core/src/exams/essays/_utils/writing-calibration-data.json";
const ANALYSIS_CUTOFF_SHARE = 0.6;
const ERROR_TOLERANCE = 1e-10;
const POINTS_TOLERANCE = 1e-6;

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

function pointErrors(answers: MeasuredAnswer[]) {
  const errors = answers
    .map(({ residual }) => Math.max(residual.over, residual.under))
    .toSorted((a, b) => a - b);

  const middle = Math.floor(errors.length / 2);

  const median =
    ((errors[middle] ?? Number.NaN) + (errors[Math.floor((errors.length - 1) / 2)] ?? Number.NaN)) /
    2;

  const within = errors.filter((error) => error <= 0.2 + ERROR_TOLERANCE).length / errors.length;

  return { median, within };
}

const percent = (value: number | null) =>
  value === null || Number.isNaN(value) ? "—" : `${(value * 100).toFixed(1)}%`;

function verdict(answers: MeasuredAnswer[], side: "above" | "below", margin: number | null) {
  if (margin === null) {
    return "—";
  }

  let runs = 0;
  let called = 0;
  let wrong = 0;

  for (const { cutoff, estimates, mark, max } of answers) {
    const threshold = (cutoff ?? ANALYSIS_CUTOFF_SHARE) * max;
    const met = mark >= threshold;

    for (const { high, low } of estimates) {
      const call =
        side === "above"
          ? low - margin * max >= threshold - POINTS_TOLERANCE
          : high + margin * max < threshold - POINTS_TOLERANCE;

      runs += 1;
      called += Number(call);
      wrong += Number(call && met !== (side === "above"));
    }
  }

  return `${percent(called / runs)} / ${percent(wrong / called)}`;
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
  "| Row kind | Held-out source | Measured / planned | Median error | Within 20% | Over / under margin | Likely above called / wrong | Likely below called / wrong |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
];

for (const kind of writingRowKind.options) {
  const folds = measured.filter((fold) => fold.kind === kind);

  for (const fold of folds) {
    const training = folds.filter(({ source }) => source !== fold.source);
    const { median, within } = pointErrors(fold.measured);
    const over = getWritingMargin(residuals(training, "over"));
    const under = getWritingMargin(residuals(training, "under"));
    const above = verdict(fold.measured, "above", over);
    const below = verdict(fold.measured, "below", under);

    table.push(
      `| ${kind} | ${fold.source} | ${fold.measured.length}/${fold.answers.length} | ${percent(median)} | ${percent(within)} | ${percent(over)} / ${percent(under)} | ${above} | ${below} |`,
    );
  }

  if (folds.filter((fold) => fold.measured.length > 0).length >= 2) {
    rows[kind] = {
      residuals: { over: residuals(folds, "over"), under: residuals(folds, "under") },
    };
  }
}

const calibration = writingCalibrationSchema.parse({ ...provenance, rows });

const formatted = execFileSync("pnpm", ["exec", "oxfmt", "--stdin-filepath", output], {
  input: JSON.stringify(calibration, null, 2),
});

await writeFile(output, formatted);
process.stdout.write(`${table.join("\n")}\n`);
