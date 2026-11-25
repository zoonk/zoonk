import { type TestCase } from "@/lib/types";
import readerFile from "../../../eval-results/blind-keys/ablation-readers.json";
import keyFile from "../../../eval-results/blind-keys/keys.json";
import { type GradeWritingInput } from "../grade-essay/cases/shared";
import { type MarkRange, getAblationMark } from "./ablation-marks";
import { ABLATIONS, getAblationSource } from "./ablations";
import { type BlindKeyFile, blindKeyInput } from "./blind-keys";
import { SOURCE_QUESTIONS, type SourceQuestion } from "./source-questions";

export type BlindKeyStratum = SourceQuestion["stratum"] | "fgv-oab-ablation";

export type BlindKeyExpected = {
  board: MarkRange;
  max: number;
  cutoffShare: number;
  stratum: BlindKeyStratum;
  sourceQuestion: string;
  kind: "real" | "ablation";
};

export type BlindKeyCase = TestCase<BlindKeyExpected, GradeWritingInput>;

const KEYS = (keyFile as BlindKeyFile).keys;

function findKey(source: SourceQuestion) {
  const key = KEYS.find(({ questionId }) => questionId === source.id);

  if (!key) {
    throw new Error(`No blind key for ${source.id}: run scripts/write-blind-keys.ts.`);
  }

  return key;
}

function findSource(caseId: string) {
  const source = SOURCE_QUESTIONS.find(({ cases }) => cases.some(({ id }) => id === caseId));

  if (!source) {
    throw new Error(`No source question for ${caseId}.`);
  }

  return source;
}

const REAL_CASES: BlindKeyCase[] = SOURCE_QUESTIONS.flatMap((source) =>
  source.cases.map((testCase) => {
    const official = testCase.expected?.officialTotal ?? 0;

    return {
      expected: {
        board: { high: official, low: official },
        cutoffShare: source.cutoffShare,
        kind: "real" as const,
        max: testCase.userInput.basis.points ?? 0,
        sourceQuestion: source.id,
        stratum: source.stratum,
      },
      id: `blind-key-${testCase.id}`,
      language: "pt",
      userInput: blindKeyInput({
        key: findKey(source),
        source,
        text: testCase.userInput.text,
        userInput: testCase.userInput,
      }),
    };
  }),
);

const ABLATION_CASES: BlindKeyCase[] = ABLATIONS.map((ablation) => {
  const { testCase, text } = getAblationSource(ablation);
  const source = findSource(testCase.id);

  return {
    expected: {
      board: getAblationMark(ablation, readerFile.marks),
      cutoffShare: source.cutoffShare,
      kind: "ablation" as const,
      max: testCase.userInput.basis.points ?? 0,
      sourceQuestion: source.id,
      stratum: "fgv-oab-ablation" as const,
    },
    id: `blind-key-ablation-${ablation.id}-pt`,
    language: "pt",
    userInput: blindKeyInput({ key: findKey(source), source, text, userInput: testCase.userInput }),
  };
});

export const TEST_CASES: BlindKeyCase[] = [...REAL_CASES, ...ABLATION_CASES];
