import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type NumericEntry, type OptionSelect } from "@zoonk/ai/tasks/v2/items/schemas";
import { type PartialCreditRule } from "@zoonk/ai/tasks/v2/research/partial-credit";
import { isUsableBlueprint } from "@zoonk/core/library/exams/blueprint-content";
import { getFormatShares } from "@zoonk/core/library/exams/format-shares";
import { normalizeString } from "@zoonk/utils/string";
import {
  type ExtractionEvalInput,
  type ExtractionEvalOutput,
  generateExtraction,
} from "./generate";
import { TEST_CASES } from "./test-cases";

type ExpectedFact =
  | { kind: "date"; date: string; dateKind?: ExtractionEvalOutput["dates"][number]["kind"] }
  | { kind: "questionCount"; value: number }
  | { kind: "subject"; name: string; questions?: number }
  | { kind: "topic"; subject: string; topic: string }
  | { kind: "group"; subject: string; group: string }
  | { kind: "choice"; options: string[]; partOf?: string }
  | { kind: "section"; minutes?: number; questions?: number }
  | { kind: "listeningParts"; parts: number; plays?: number; questions: number }
  | {
      kind: "format";
      format: ExtractionEvalOutput["formats"][number]["kind"];
      entry?: NumericEntry["kind"];
      partialCredit?: PartialCreditRule;
      select?: OptionSelect;
      share?: number;
    }
  | { kind: "scoring"; method: NonNullable<ExtractionEvalOutput["mock"]>["scoring"]["method"] }
  | { kind: "wrongPenalty"; value: number }
  | { kind: "scale"; max: number; min: number }
  | { kind: "breakAfter"; minutes: number }
  | { kind: "tools"; mentions: string }
  | { kind: "testedLanguage"; language: string | null }
  | { kind: "timeLimit"; minutes: number };

export type ExtractionExpected = { facts: ExpectedFact[]; usable?: boolean };

type Reading = {
  dates: Pick<ExtractionEvalOutput["dates"][number], "date" | "kind">[];
  formats: (Pick<ExtractionEvalOutput["formats"][number], "kind"> & {
    entry?: NumericEntry | null;
    partialCredit?: PartialCreditRule | null;
    select?: OptionSelect | null;
    share?: number | null;
  })[];
  mock:
    | (Pick<NonNullable<ExtractionEvalOutput["mock"]>, "timeLimitMinutes" | "totalQuestions"> & {
        scoring: Pick<NonNullable<ExtractionEvalOutput["mock"]>["scoring"], "method"> & {
          scale?: { max: number; min: number } | null;
          wrongPenalty?: number | null;
        };
        sections: (Pick<
          NonNullable<ExtractionEvalOutput["mock"]>["sections"][number],
          "day" | "minutes" | "name" | "questions"
        > & {
          breakAfterMinutes?: number | null;
          kind?: string;
          tasks?: { count: number; plays?: number | null }[];
          tools?: string | null;
        })[];
      })
    | null;
  questionCount: number | null;
  subjects: (Pick<ExtractionEvalOutput["subjects"][number], "name" | "questions" | "topics"> & {
    choiceGroup?: string | null;
    group?: string | null;
    partOf?: string | null;
  })[];
  testedLanguage: string | null;
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

function hasListeningParts({
  fact,
  reading,
}: {
  fact: Extract<ExpectedFact, { kind: "listeningParts" }>;
  reading: Reading;
}) {
  return (reading.mock?.sections ?? []).some((section) => {
    const tasks = section.tasks ?? [];

    return (
      section.kind === "listening" &&
      tasks.length === fact.parts &&
      tasks.every(
        (task) =>
          task.count === fact.questions && (fact.plays === undefined || task.plays === fact.plays),
      )
    );
  });
}

function sumQuestions(items: { questions: number | null }[]): number | null {
  const counts = items.map((item) => item.questions).filter((count) => count !== null);
  return counts.length > 0 ? counts.reduce((total, count) => total + count, 0) : null;
}

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

function hasChoice({
  fact,
  reading,
}: {
  fact: Extract<ExpectedFact, { kind: "choice" }>;
  reading: Reading;
}): boolean {
  const options = fact.options.map((option) =>
    reading.subjects.find((subject) =>
      normalizeString(subject.name).includes(normalizeString(option)),
    ),
  );

  const groups = new Set(options.map((option) => option?.choiceGroup ?? null));
  const [group] = groups;

  const isInside = (option: Reading["subjects"][number] | undefined) =>
    fact.partOf === undefined ||
    normalizeString(option?.partOf ?? "").includes(normalizeString(fact.partOf));

  return Boolean(group) && groups.size === 1 && options.every((option) => isInside(option));
}

const SHARE_TOLERANCE = 0.02;

function hasFormat({
  fact,
  reading,
}: {
  fact: Extract<ExpectedFact, { kind: "format" }>;
  reading: Reading;
}): boolean {
  return reading.formats.some(
    (format) =>
      format.kind === fact.format &&
      (fact.entry === undefined || format.entry?.kind === fact.entry) &&
      (fact.partialCredit === undefined || format.partialCredit === fact.partialCredit) &&
      (fact.select === undefined || format.select === fact.select) &&
      (fact.share === undefined ||
        (typeof format.share === "number" &&
          Math.abs(format.share - fact.share) <= SHARE_TOLERANCE)),
  );
}

const MOCK_FACT_KINDS = [
  "breakAfter",
  "listeningParts",
  "scale",
  "scoring",
  "section",
  "timeLimit",
  "tools",
  "wrongPenalty",
] as const;

type MockFact = Extract<ExpectedFact, { kind: (typeof MOCK_FACT_KINDS)[number] }>;

function isMockFact(fact: ExpectedFact): fact is MockFact {
  return MOCK_FACT_KINDS.some((kind) => kind === fact.kind);
}

function isScoringFactFound({
  fact,
  scoring,
}: {
  fact: Extract<MockFact, { kind: "scale" | "scoring" | "wrongPenalty" }>;
  scoring: NonNullable<Reading["mock"]>["scoring"] | null;
}): boolean {
  switch (fact.kind) {
    case "scoring":
      return scoring?.method === fact.method;
    case "wrongPenalty":
      return scoring?.wrongPenalty === fact.value;
    case "scale":
      return scoring?.scale?.min === fact.min && scoring.scale.max === fact.max;
    default:
      return false;
  }
}

function isMockFactFound({ fact, reading }: { fact: MockFact; reading: Reading }): boolean {
  const sections = reading.mock?.sections ?? [];

  switch (fact.kind) {
    case "section":
      return hasSection({ fact, reading });
    case "listeningParts":
      return hasListeningParts({ fact, reading });
    case "scale":
    case "scoring":
    case "wrongPenalty":
      return isScoringFactFound({ fact, scoring: reading.mock?.scoring ?? null });
    case "breakAfter":
      return sections.some((section) => section.breakAfterMinutes === fact.minutes);
    case "tools":
      return sections.some((section) =>
        normalizeString(section.tools ?? "").includes(normalizeString(fact.mentions)),
      );
    case "timeLimit":
      return (
        reading.mock?.timeLimitMinutes === fact.minutes ||
        (reading.mock?.sections ?? []).some((section) => section.minutes === fact.minutes)
      );
    default:
      return false;
  }
}

function isFactFound({ fact, reading }: { fact: ExpectedFact; reading: Reading }): boolean {
  if (isMockFact(fact)) {
    return isMockFactFound({ fact, reading });
  }

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
    case "choice":
      return hasChoice({ fact, reading });
    case "format":
      return hasFormat({ fact, reading });
    case "testedLanguage":
      return reading.testedLanguage === fact.language;
    default:
      return false;
  }
}

function fromExtraction(output: ExtractionEvalOutput): Reading {
  const shares = getFormatShares(
    output.formats.map((format) => ({ count: format.count ?? null, kind: format.kind })),
  );

  return {
    ...output,
    formats: output.formats.map((format, index) => ({ ...format, share: shares[index] })),
    questionCount: output.edition.questionCount,
    testedLanguage: output.testedLanguage?.language ?? null,
  };
}

function fromKept({ kept }: ExtractionEvalOutput): Reading {
  return {
    dates: kept.edition.dates,
    formats: kept.structure.formats,
    mock: kept.structure.mock,
    questionCount: kept.edition.questionCount,
    subjects: kept.structure.subjects,
    testedLanguage: kept.structure.testedLanguage?.language ?? null,
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

const scoreExtraction: TaskScorer<ExtractionExpected> = ({ output, testCase }) => {
  const parsed = parseOutput(output);

  if (!parsed?.kept) {
    return createFixedScore({ conclusion: "Invalid output", score: MIN_SCORE });
  }

  const facts = testCase.expected?.facts ?? [];
  const usable = testCase.expected?.usable;
  const missing = (reading: Reading) => facts.filter((fact) => !isFactFound({ fact, reading }));
  const dropped = missing(fromKept(parsed));
  const unread = missing(fromExtraction(parsed));
  const isUsable = isUsableBlueprint({ content: parsed.kept, shared: true });
  const usableWrong = usable !== undefined && isUsable !== usable;
  const expectedCount = facts.length + (usable === undefined ? 0 : 1);
  const right = expectedCount - dropped.length - (usableWrong ? 1 : 0);
  const factShare = expectedCount === 0 ? 1 : right / expectedCount;
  const { found, total } = parsed.passageCheck;
  const passageShare = total === 0 ? 0 : found / total;

  const conclusion = [
    `Facts kept ${facts.length - dropped.length}/${facts.length} (read ${facts.length - unread.length})`,
    `passages found ${found}/${total}`,
    parsed.reading ? `problems left ${parsed.reading.problems.length}` : "",
    dropped.length > 0 ? `missing: ${dropped.map((fact) => describeFact(fact)).join("; ")}` : "",
    usableWrong
      ? `research would ${isUsable ? "store" : "not store"} it as the exam's blueprint`
      : "",
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
