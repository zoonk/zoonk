import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { type WritingRowKind } from "@zoonk/core/exams/essays/writing-contract";
import { type BlindKeyFile, blindKeyInput } from "../grade-essay-blind-key/blind-keys";
import { SOURCE_QUESTIONS } from "../grade-essay-blind-key/source-questions";
import { ENEM_CALIBRATION_MARKS, loadEnemCalibrationCases } from "./cases/enem-calibration";
import { ELLIPSE_CASES, asapCases } from "./cases/published-scales";
import { SAF_CASES, SAF_KEY_SOURCES } from "./cases/saf";
import { type GradeWritingInput, type WritingCase } from "./cases/shared";

export type CalibrationAnswer = {
  answer: string;
  source: string;
  cutoff: number | null;
  mark: number;
  max: number;
};

export type CalibrationJob = CalibrationAnswer & { input: GradeWritingInput; draw: number };

export type CalibrationCohort = {
  source: string;
  answers: CalibrationAnswer[];
  draws: readonly number[];
  kind: WritingRowKind;
};

const BOARD = [
  { cases: asapCases(), kind: "boardScale", source: "asap" },
  { cases: ELLIPSE_CASES, kind: "boardScale", source: "ellipse" },
  { cases: SAF_CASES, kind: "definitePoint", source: "saf" },
] as const;

const BLIND = [
  { kind: "definitePoint", source: "fgv-oab" },
  { kind: "judgedScale", source: "cacd-history" },
  { kind: "judgedScale", source: "cacd-economics" },
  { kind: "judgedScale", source: "cacd-law" },
] as const;

const KEYED_DRAWS = [1, 2, 3] as const;
export const CALIBRATION_REPEATS = 3;
export const CALIBRATION_KEYS_PATH = "eval-results/written-calibration/keys.json";

function answerMetadata(
  { expected, id, userInput }: WritingCase,
  source: string,
  cutoff: number | null,
): CalibrationAnswer {
  if (expected?.officialTotal === undefined || userInput.basis.points === null) {
    throw new Error(`Calibration answer ${id} needs a mark and maximum.`);
  }

  return { answer: id, cutoff, mark: expected.officialTotal, max: userInput.basis.points, source };
}

function fromBoard(cases: WritingCase[], source: string): CalibrationJob[] {
  return cases.map((testCase) => ({
    ...answerMetadata(testCase, source, null),
    draw: 0,
    input: testCase.userInput,
  }));
}

export function listCalibrationCohorts(): CalibrationCohort[] {
  return [
    ...BOARD.map(({ cases, kind, source }) => ({
      answers: cases.map((testCase) => answerMetadata(testCase, source, null)),
      draws: source === "saf" ? [0, ...KEYED_DRAWS] : [0],
      kind,
      source,
    })),
    {
      answers: ENEM_CALIBRATION_MARKS.map(({ answer, mark }) => ({
        answer,
        cutoff: null,
        mark,
        max: 1000,
        source: "enem",
      })),
      draws: [0],
      kind: "boardScale",
      source: "enem",
    },
    ...BLIND.map(({ kind, source }) => ({
      answers: SOURCE_QUESTIONS.filter(({ stratum }) => stratum === source).flatMap(
        ({ cases, cutoffShare }) =>
          cases.map((testCase) => answerMetadata(testCase, source, cutoffShare)),
      ),
      draws: KEYED_DRAWS,
      kind,
      source,
    })),
  ];
}

export async function readCalibrationKeys(file = CALIBRATION_KEYS_PATH): Promise<BlindKeyFile> {
  return JSON.parse(await readFile(file, "utf8")) as BlindKeyFile;
}

export function getKeysRevision({ appendedInstructions, keys }: BlindKeyFile, selection?: string) {
  const sourceIds = selection && new Set(listBlindSources(selection).map(({ id }) => id));
  const included = sourceIds ? keys.filter(({ questionId }) => sourceIds.has(questionId)) : keys;

  return createHash("sha256")
    .update(
      JSON.stringify({
        appendedInstructions,
        keys: included
          .map(({ data, draw, model, promptRevision, questionId }) => ({
            data,
            draw,
            model,
            promptRevision,
            questionId,
          }))
          .toSorted((a, b) => a.questionId.localeCompare(b.questionId) || a.draw - b.draw),
      }),
    )
    .digest("hex");
}

function listBlindSources(selection: string) {
  return selection === "saf"
    ? SAF_KEY_SOURCES.map((source) => ({ ...source, cutoffShare: null }))
    : SOURCE_QUESTIONS.filter(({ stratum }) => selection === stratum);
}

export async function getCalibrationJobs(
  selection: string,
  keyFile?: string,
): Promise<CalibrationJob[]> {
  if (selection === "enem") {
    return fromBoard(await loadEnemCalibrationCases(), selection);
  }

  if (selection === "asap") {
    const file = process.env.WRITING_CALIBRATION_ASAP_SOURCES;

    if (!file) {
      throw new Error(
        "Provide the transcribed public source articles in WRITING_CALIBRATION_ASAP_SOURCES.",
      );
    }

    const articles = JSON.parse(await readFile(file, "utf8")) as Record<string, string>;
    const cases = asapCases(articles);

    if (cases.some(({ userInput }) => !userInput.context?.trim())) {
      throw new Error("Every source-dependent answer needs its original source article.");
    }

    return fromBoard(cases, selection);
  }

  const board = BOARD.find(({ source }) => selection === (source === "saf" ? "saf-board" : source));

  if (board) {
    return fromBoard(board.cases, board.source);
  }

  const sources = listBlindSources(selection);

  if (sources.length === 0) {
    throw new Error(`Unknown calibration cohort ${selection}.`);
  }

  const saved = await readCalibrationKeys(keyFile);

  return sources.flatMap((source) =>
    KEYED_DRAWS.flatMap((draw) => {
      const key = saved.keys.find(
        ({ draw: index, questionId }) => questionId === source.id && index === draw,
      );

      if (
        !key?.copiedQuestion ||
        key.data.context !== source.context ||
        key.data.aspects.some(({ kind }) => !kind)
      ) {
        process.stderr.write(`Skipped incomplete key for ${source.id}, draw ${draw}.\n`);
        return [];
      }

      return source.cases.map((testCase) => ({
        ...answerMetadata(testCase, selection, source.cutoffShare),
        draw,
        input: blindKeyInput({
          key,
          source,
          text: testCase.userInput.text,
          userInput: testCase.userInput,
        }),
      }));
    }),
  );
}
