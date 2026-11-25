import { type TestCase } from "@/lib/types";
import readerFile from "../../../eval-results/blind-keys/ablation-readers.json";
import keyFile from "../../../eval-results/blind-keys/keys.json";
import { type GradeWritingInput } from "../grade-essay/cases/shared";
import { type MarkRange, getAblationMark } from "./ablation-marks";
import { ABLATIONS, getAblationSource } from "./ablations";
import { type BlindKey, type BlindKeyFile, blindKeyInput } from "./blind-keys";
import { SOURCE_QUESTIONS, type SourceQuestion } from "./source-questions";

type BlindKeyStratum = SourceQuestion["stratum"] | "fgv-oab-ablation";

/** `answer` names the graded answer apart from the key draw, so its draws calibrate as one. */
export type BlindKeyExpected = {
  answer: string;
  board: MarkRange;
  draw: number;
  max: number;
  cutoffShare: number;
  stratum: BlindKeyStratum;
  sourceQuestion: string;
  kind: "real" | "ablation";
};

type BlindKeyCase = TestCase<BlindKeyExpected, GradeWritingInput>;

const KEYS = (keyFile as BlindKeyFile).keys;

function findKeys(source: SourceQuestion): BlindKey[] {
  const keys = KEYS.filter(({ questionId }) => questionId === source.id);

  if (keys.length === 0) {
    throw new Error(`No blind key for ${source.id}: run scripts/write-blind-keys.ts.`);
  }

  return keys;
}

function findSource(caseId: string) {
  const source = SOURCE_QUESTIONS.find(({ cases }) => cases.some(({ id }) => id === caseId));

  if (!source) {
    throw new Error(`No source question for ${caseId}.`);
  }

  return source;
}

/** Draw 1 keeps the ids its saved runs were written under. */
const caseId = (answer: string, draw: number) =>
  draw === 1 ? `blind-key-${answer}` : `blind-key-draw-${draw}-${answer}`;

const REAL_CASES: BlindKeyCase[] = SOURCE_QUESTIONS.flatMap((source) =>
  findKeys(source).flatMap((key) =>
    source.cases.map((testCase) => {
      const official = testCase.expected?.officialTotal ?? 0;

      return {
        expected: {
          answer: testCase.id,
          board: { high: official, low: official },
          cutoffShare: source.cutoffShare,
          draw: key.draw,
          kind: "real" as const,
          max: testCase.userInput.basis.points ?? 0,
          sourceQuestion: source.id,
          stratum: source.stratum,
        },
        id: caseId(testCase.id, key.draw),
        language: "pt",
        userInput: blindKeyInput({
          key,
          source,
          text: testCase.userInput.text,
          userInput: testCase.userInput,
        }),
      };
    }),
  ),
);

const ABLATION_CASES: BlindKeyCase[] = ABLATIONS.flatMap((ablation) => {
  const { testCase, text } = getAblationSource(ablation);
  const source = findSource(testCase.id);
  const answer = `ablation-${ablation.id}-pt`;

  return findKeys(source).map((key) => ({
    expected: {
      answer,
      board: getAblationMark(ablation, readerFile.marks),
      cutoffShare: source.cutoffShare,
      draw: key.draw,
      kind: "ablation" as const,
      max: testCase.userInput.basis.points ?? 0,
      sourceQuestion: source.id,
      stratum: "fgv-oab-ablation" as const,
    },
    id: caseId(answer, key.draw),
    language: "pt",
    userInput: blindKeyInput({ key, source, text, userInput: testCase.userInput }),
  }));
});

export const TEST_CASES: BlindKeyCase[] = [...REAL_CASES, ...ABLATION_CASES];
