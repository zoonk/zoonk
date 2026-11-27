import { type TestCase } from "@/lib/types";
import { type writtenItemSchema } from "@zoonk/core/exams/essays/writing-contract";
import { WRITING_CHARACTERS_PER_LINE } from "@zoonk/core/exams/essays/writing-lines";
import { type z } from "zod";

export type Basis = z.infer<typeof writtenItemSchema>;
export type Grading = Basis["grading"];
export type WritingCase = TestCase<GradeWritingExpected, GradeWritingInput>;
export type ZeroKind = NonNullable<Grading["zeroing"][number]["kinds"]>[number];

export type GradeWritingInput = {
  language: string;
  question: string;
  context: string | null;
  text: string;
  keyPoints: string[];
  basis: Basis;
  numeric: boolean;
};

/**
 * `languageErrors` and `traps` are passages of the answer: a reported error must overlap one of
 * `languageErrors` (a planted error, or a real slip of a published answer), and none may overlap a
 * trap, a usage the standard accepts. An omitted key means the passages are unknown.
 * An empty key means no error passages are expected.
 */
export type GradeWritingExpected = {
  earned: number[];
  uncertain?: number[];
  languageErrors?: string[];
  officialErrorCount?: number;
  traps?: string[];
  zero: boolean;
  minimumLevel?: "strong" | "complete";
  nextStepCriteria?: string[];
  officialTotal?: number;
  officialContent?: number;
  officialCompetences?: Record<string, number>;
  cacd?: {
    comparative: boolean;
    /** Null when the guide gives only the total. An empty list means every item earned full credit. */
    itemsBelowMaximum: number[] | null;
    questionReference: string;
    subject: "economics" | "law";
    writtenLines: number | null;
    year: number;
  };
  passBoundary?: { sectionMinimum: number; otherAnswers: number };
  source?: {
    board: string;
    reference: string | null;
    notice?: string;
    author: string;
    scoreReference?: string;
  };
  zeroKind?: ZeroKind;
  /** Why a published answer is left out of calibration, such as a transcription that can't be what the board read. */
  doubtful?: string;
  feedbackLanguage: "de" | "en" | "pt";
};

const ANCHOR_SKILL = "0195f1d2-7c4a-7d3e-9a10-4b5c6d7e8f90";

export function points(aspects: [string, number][], criterionId = "content") {
  return aspects.map(([description, value]) => ({ criterionId, description, points: value }));
}

export function basis({
  aspects,
  criteria,
  grading,
  lines,
  minimumWords = 30,
  taskKey,
  title,
  total,
}: {
  aspects: Basis["aspects"];
  criteria: Basis["criteria"];
  grading: Grading;
  lines: number | null;
  minimumWords?: number;
  taskKey: string;
  title: string;
  total: number | null;
}): Basis {
  return {
    aspects,
    assessedSkillIds: [ANCHOR_SKILL],
    charactersPerLine: WRITING_CHARACTERS_PER_LINE,
    criteria,
    grading,
    keySource: "publishedStandard",
    lines,
    minimumWords,
    points: total,
    taskKey,
    title,
    unit: "answer",
  };
}

export function publishedCase({
  id,
  userInput,
  source,
  expected,
}: {
  id: string;
  userInput: GradeWritingInput;
  source: NonNullable<GradeWritingExpected["source"]>;
  expected: Partial<Omit<GradeWritingExpected, "source">>;
}): WritingCase {
  return {
    expected: { earned: [], feedbackLanguage: "pt", zero: false, ...expected, source },
    id: `${id}-pt`,
    language: "pt",
    userInput,
  };
}

export function publishedQuestion({
  title,
  taskKey,
  conventions,
  lines,
  sections,
  citation,
  question,
  text,
}: {
  title: string;
  taskKey: string;
  conventions?: Grading["conventions"];
  lines: number;
  sections: { id: string; name: string; aspects: [string, number][] }[];
  citation: { passage: string; sourceId: string };
  question: string;
  text: string;
}): GradeWritingInput {
  const aspects = sections.flatMap((section) => points(section.aspects, section.id));

  const criteria = sections.map(({ aspects: rows, id, name }) => ({
    id,
    name,
    points: Number(rows.reduce((sum, [, value]) => sum + value, 0).toFixed(2)),
  }));

  const total = Number(criteria.reduce((sum, criterion) => sum + criterion.points, 0).toFixed(2));

  return {
    basis: basis({
      aspects,
      criteria,
      grading: {
        criteria: criteria.map(({ id, name, points: value }) => ({
          citation,
          id,
          points: value,
          text: name,
        })),
        ...(conventions && { conventions }),
        language: null,
        rounding: null,
        zeroing: [],
      },
      lines,
      taskKey,
      title,
      total,
    }),
    context: null,
    keyPoints: aspects.map((aspect) => aspect.description),
    language: "pt",
    numeric: true,
    question,
    text,
  };
}
