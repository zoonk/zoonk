import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { normalizeString } from "@zoonk/utils/string";
import {
  type ExtractionEvalInput,
  type ExtractionEvalOutput,
  generateExtraction,
} from "./generate";
import { TEST_CASES } from "./test-cases";

/** One fact a correct reading of the notice must contain. */
type ExpectedFact =
  | { kind: "date"; date: string; dateKind?: ExtractionEvalOutput["dates"][number]["kind"] }
  | { kind: "questionCount"; value: number }
  | { kind: "subject"; name: string; questions?: number }
  /** One item of a subject's syllabus, which must be among its topics, word for word. */
  | { kind: "topic"; subject: string; topic: string }
  /** The part of the exam the notice puts a subject in. */
  | { kind: "group"; subject: string; group: string }
  | { kind: "section"; minutes?: number; questions?: number }
  | { kind: "format"; format: ExtractionEvalOutput["formats"][number]["kind"] }
  | { kind: "scoring"; method: NonNullable<ExtractionEvalOutput["mock"]>["scoring"]["method"] }
  | { kind: "timeLimit"; minutes: number };

export type ExtractionExpected = { facts: ExpectedFact[] };

/** What the expected facts are looked up in: the model's reading, or what both checks kept. */
type Reading = {
  dates: Pick<ExtractionEvalOutput["dates"][number], "date" | "kind">[];
  formats: Pick<ExtractionEvalOutput["formats"][number], "kind">[];
  mock:
    | (Pick<
        NonNullable<ExtractionEvalOutput["mock"]>,
        "scoring" | "timeLimitMinutes" | "totalQuestions"
      > & {
        sections: Pick<
          NonNullable<ExtractionEvalOutput["mock"]>["sections"][number],
          "day" | "minutes" | "name" | "questions"
        >[];
      })
    | null;
  questionCount: number | null;
  subjects: (Pick<ExtractionEvalOutput["subjects"][number], "name" | "questions" | "topics"> & {
    group?: string | null;
  })[];
};

const MIN_SCORE = 6;
const SCORE_RANGE = 4;
const FACT_WEIGHT = 0.8;
const PASSAGE_WEIGHT = 0.2;

function hasSection({
  fact,
  reading,
}: {
  fact: Extract<ExpectedFact, { kind: "section" }>;
  reading: Reading;
}) {
  const sections = [
    ...(reading.mock?.sections ?? []),
    ...reading.subjects.map((subject) => ({ minutes: null, questions: subject.questions })),
  ];

  return sections.some(
    (section) =>
      (fact.questions === undefined || section.questions === fact.questions) &&
      (fact.minutes === undefined || section.minutes === fact.minutes),
  );
}

/** Parts without a count, such as an essay, don't add questions. */
function sumQuestions(items: { questions: number | null }[]): number | null {
  const counts = items.map((item) => item.questions).filter((count) => count !== null);
  return counts.length > 0 ? counts.reduce((total, count) => total + count, 0) : null;
}

/**
 * Notices often state each part's questions and not the total ("four tests of
 * 45 questions each"). The prompt forbids inferring numbers, so a total the
 * parts add up to counts as found.
 */
function getQuestionTotals(reading: Reading): number[] {
  return [
    reading.questionCount,
    reading.mock?.totalQuestions ?? null,
    sumQuestions(reading.mock?.sections ?? []),
    sumQuestions(reading.subjects),
  ].filter((total) => total !== null);
}

function findSubject({ name, reading }: { name: string; reading: Reading }) {
  return reading.subjects.find(
    (subject) => normalizeString(subject.name) === normalizeString(name),
  );
}

function isFactFound({ fact, reading }: { fact: ExpectedFact; reading: Reading }): boolean {
  switch (fact.kind) {
    case "date":
      return reading.dates.some(
        (date) => date.date === fact.date && (!fact.dateKind || date.kind === fact.dateKind),
      );
    case "questionCount":
      return getQuestionTotals(reading).includes(fact.value);
    case "subject":
      return reading.subjects.some(
        (subject) =>
          normalizeString(subject.name).includes(normalizeString(fact.name)) &&
          (fact.questions === undefined || subject.questions === fact.questions),
      );
    case "topic":
      return (
        findSubject({ name: fact.subject, reading })?.topics.some(
          (topic) => normalizeString(topic) === normalizeString(fact.topic),
        ) ?? false
      );
    case "group":
      return normalizeString(findSubject({ name: fact.subject, reading })?.group ?? "").includes(
        normalizeString(fact.group),
      );
    case "section":
      return hasSection({ fact, reading });
    case "format":
      return reading.formats.some((format) => format.kind === fact.format);
    case "scoring":
      return reading.mock?.scoring.method === fact.method;
    case "timeLimit":
      return (
        reading.mock?.timeLimitMinutes === fact.minutes ||
        (reading.mock?.sections ?? []).some((section) => section.minutes === fact.minutes)
      );
    default:
      return false;
  }
}

function fromExtraction(output: ExtractionEvalOutput): Reading {
  return { ...output, questionCount: output.edition.questionCount };
}

function fromKept({ kept }: ExtractionEvalOutput): Reading {
  return {
    dates: kept.edition.dates,
    formats: kept.structure.formats,
    mock: kept.structure.mock,
    questionCount: kept.edition.questionCount,
    subjects: kept.structure.subjects,
  };
}

function parseOutput(output: string): ExtractionEvalOutput | null {
  try {
    return JSON.parse(output) as ExtractionEvalOutput;
  } catch {
    return null;
  }
}

function describeFact(fact: ExpectedFact): string {
  return JSON.stringify(fact);
}

/**
 * Accuracy on the facts that matter for planning and mocks, counted in what
 * research keeps after both citation checks (what learners plan with), plus
 * the share of quoted passages code finds in the documents (invented quotes
 * cost points). The conclusion also says how many the reading itself had, so
 * a fact the checks dropped shows apart from one the model missed.
 */
const scoreExtraction: TaskScorer<ExtractionExpected> = ({ output, testCase }) => {
  const parsed = parseOutput(output);

  if (!parsed?.kept) {
    return createFixedScore({ conclusion: "Invalid output", score: MIN_SCORE });
  }

  const facts = testCase.expected?.facts ?? [];
  const missing = (reading: Reading) => facts.filter((fact) => !isFactFound({ fact, reading }));
  const dropped = missing(fromKept(parsed));
  const unread = missing(fromExtraction(parsed));
  const factShare = facts.length === 0 ? 1 : (facts.length - dropped.length) / facts.length;
  const { found, total } = parsed.passageCheck;
  const passageShare = total === 0 ? 0 : found / total;

  const conclusion = [
    `Facts kept ${facts.length - dropped.length}/${facts.length} (read ${facts.length - unread.length})`,
    `passages found ${found}/${total}`,
    dropped.length > 0 ? `missing: ${dropped.map((fact) => describeFact(fact)).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return createFixedScore({
    conclusion,
    score: MIN_SCORE + SCORE_RANGE * (FACT_WEIGHT * factShare + PASSAGE_WEIGHT * passageShare),
  });
};

export const extractExamBlueprintTask: Task<
  ExtractionEvalInput,
  ExtractionEvalOutput,
  ExtractionExpected
> = {
  description:
    "Extract an exam blueprint from real notices, every fact quoting its passage and surviving both citation checks",
  generate: generateExtraction,
  id: "extract-exam-blueprint",
  name: "Extract Exam Blueprint",
  score: scoreExtraction,
  testCases: TEST_CASES,
};
