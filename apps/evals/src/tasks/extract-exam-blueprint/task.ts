import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type NumericEntry, type OptionSelect } from "@zoonk/ai/tasks/items/schemas";
import { type PartialCreditRule } from "@zoonk/ai/tasks/research/partial-credit";
import { isComputableSheet } from "@zoonk/core/exams/essays/writing-sheet";
import { isUsableBlueprint } from "@zoonk/core/library/exams/blueprint-content";
import { getFormatShares } from "@zoonk/core/library/exams/format-shares";
import { getMarkingPenalty } from "@zoonk/core/library/exams/marking-penalty";
import { findTaskSubjects } from "@zoonk/core/library/exams/written-task-subjects";
import { normalizeString } from "@zoonk/utils/string";
import {
  type ExtractionEvalInput,
  type ExtractionEvalOutput,
  generateExtraction,
} from "./generate";
import { TEST_CASES } from "./test-cases";

type ExpectedFact =
  | { kind: "date"; date: string; dateKind?: ExtractionEvalOutput["dates"][number]["kind"] }
  /** `mock` checks the mock's own total, which sizes objective sittings without a count. */
  | { kind: "questionCount"; value: number; in?: "mock" }
  | { kind: "subject"; name: string; questions?: number }
  /** Without `subject`, any subject may hold the topic. */
  | { kind: "topic"; subject?: string; topic: string }
  /** Learner material: every topic names an idea, never a copied line of notes. */
  | { kind: "shortTopics" }
  | { kind: "group"; subject: string; group: string }
  | { kind: "groupedSubjects"; groups: string[] }
  | { kind: "choice"; options: string[]; partOf?: string; take?: number }
  | { kind: "section"; day?: number; minutes?: number; name?: string; questions?: number }
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
  | { kind: "markingRow"; part: string[]; points: number; wrongPoints?: number }
  | {
      kind: "scoredPart";
      maxPoints?: number;
      minimum?: PointsMinimum;
      part: string[];
      qualifying?: boolean;
      questions?: number;
    }
  | { kind: "totalMinimum"; minimum: PointsMinimum | null }
  | { kind: "finalShare"; parts: string[]; share: number }
  | { kind: "wrongPenalty"; value: number }
  | { kind: "scale"; max: number; min: number }
  | { kind: "breakAfter"; minutes: number }
  | { kind: "tools"; mentions: string }
  | { kind: "testedLanguage"; language: string | null }
  | { kind: "timeLimit"; minutes: number }
  | { kind: "session"; mentions: string }
  | { kind: "sharedClock" }
  | WrittenTaskFact;

/** A written task as the notice states it; a field left out isn't checked, `null` must be unknown. */
type WrittenTaskFact = {
  kind: "writtenTask";
  combination?: "sum" | "mean" | null;
  count?: number;
  criterionPoints?: number[];
  /** The sum of the criteria's maxima, for a sheet whose rows may be split several ways. */
  criteriaTotal?: number;
  /** The group whose every subject, and only those, the task is on; null when it names none. */
  drawsOn?: string | null;
  handwritten?: boolean | null;
  language?: { factor: number; method: "errorsPerLine" | "perError" | "other" } | null;
  /** How many caps on criteria the sheet holds at least. */
  limits?: number;
  lines?: number | null;
  /** How many counted elements the sheet's criteria hold together. */
  parts?: number;
  points?: number | null;
  rounding?: boolean;
  /** Each criterion's scale as its levels' points, lowest first; null for a criterion without one. */
  scales?: (number[] | null)[];
  /** Whether the sheet's own arithmetic works out the answer's points. */
  total?: boolean;
  zeroing?: boolean;
  /** Triggers the zero rules must cover, at least. */
  zeroKinds?: string[];
};

type WrittenGrading = {
  combination?: { method: string; step: number | null } | null;
  criteria: {
    awards?: { count?: number | null; points: number | null; pointsHigh?: number | null }[];
    id: string;
    parts?: unknown[];
    points: number | null;
    weight?: number | null;
  }[];
  deductions?: unknown[];
  language: { factor: number | null; formula: string | null; method: string } | null;
  limits?: { criteria: string[]; max: number }[];
  rounding: {
    mode?: "nearest" | "down" | "up" | null;
    stage?: "criterion" | "total" | null;
    step?: number | null;
  } | null;
  totalSuppressed?: boolean;
  zeroing: { kinds?: string[] }[];
};

type WrittenTask = {
  count: number;
  grading?: WrittenGrading | null;
  handwritten?: boolean | null;
  lines?: number | null;
  points?: number | null;
  subjects?: string[] | null;
};

type PointsMinimum = { unit: "percent" | "points"; value: number };

export type ExtractionExpected = { facts: ExpectedFact[]; usable?: boolean };

type Reading = {
  choiceGroups?: { name: string; take: number }[];
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
          finalShares?: { parts: string[]; share: number }[];
          marking?: {
            part: string | null;
            points: number;
            questions: number | null;
            wrongPoints: number | null;
          }[];
          parts?: {
            maxPoints: number | null;
            minimum: PointsMinimum | null;
            name: string;
            qualifying: boolean;
            questions: number | null;
          }[];
          scale?: { max: number; min: number } | null;
          totalMinimum?: PointsMinimum | null;
          wrongPenalty?: number | null;
        };
        sections: (Pick<
          NonNullable<ExtractionEvalOutput["mock"]>["sections"][number],
          "day" | "minutes" | "name" | "questions"
        > & {
          breakAfterMinutes?: number | null;
          kind?: string;
          session?: string | null;
          tasks?: (WrittenTask & { plays?: number | null })[];
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
    ...reading.subjects.map((subject) => ({
      day: null,
      minutes: null,
      name: subject.name,
      questions: subject.questions,
    })),
  ];

  return sections.some(
    (section) =>
      (fact.questions === undefined || section.questions === fact.questions) &&
      (fact.minutes === undefined || section.minutes === fact.minutes) &&
      (fact.day === undefined || section.day === fact.day) &&
      (fact.name === undefined ||
        normalizeString(section.name).includes(normalizeString(fact.name))),
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
  const wanted = normalizeString(name);
  const exact = reading.subjects.find((subject) => normalizeString(subject.name) === wanted);

  const named = reading.subjects.filter((subject) =>
    normalizeString(subject.name).includes(wanted),
  );

  return exact ?? (named.length === 1 ? named[0] : undefined);
}

function hasGroupedSubjects({
  fact,
  reading,
}: {
  fact: Extract<ExpectedFact, { kind: "groupedSubjects" }>;
  reading: Reading;
}): boolean {
  const groups = reading.subjects.map((subject) => subject.group ?? null);

  return (
    groups.every((group) => group !== null) &&
    fact.groups.every((name) => groups.some((group) => namesPart({ name: group, names: [name] })))
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
    reading.subjects.find(
      (subject) =>
        subject.choiceGroup && normalizeString(subject.name).includes(normalizeString(option)),
    ),
  );

  const groups = new Set(options.map((option) => option?.choiceGroup ?? null));
  const [group] = groups;

  const isInside = (option: Reading["subjects"][number] | undefined) =>
    fact.partOf === undefined ||
    normalizeString(option?.partOf ?? "").includes(normalizeString(fact.partOf));

  const take = reading.choiceGroups?.find((item) => item.name === group)?.take ?? 1;

  return (
    Boolean(group) &&
    groups.size === 1 &&
    options.every((option) => isInside(option)) &&
    (fact.take === undefined || take === fact.take)
  );
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
  "session",
  "sharedClock",
  "writtenTask",
  "finalShare",
  "listeningParts",
  "markingRow",
  "scale",
  "scoredPart",
  "scoring",
  "section",
  "timeLimit",
  "tools",
  "totalMinimum",
  "wrongPenalty",
] as const;

type MockFact = Extract<ExpectedFact, { kind: (typeof MOCK_FACT_KINDS)[number] }>;

function isMockFact(fact: ExpectedFact): fact is MockFact {
  return MOCK_FACT_KINDS.some((kind) => kind === fact.kind);
}

const SCORING_FACT_KINDS = [
  "finalShare",
  "markingRow",
  "scale",
  "scoredPart",
  "scoring",
  "totalMinimum",
  "wrongPenalty",
] as const;

type ScoringFact = Extract<MockFact, { kind: (typeof SCORING_FACT_KINDS)[number] }>;

function isScoringFact(fact: MockFact): fact is ScoringFact {
  return SCORING_FACT_KINDS.some((kind) => kind === fact.kind);
}

const PENALTY_TOLERANCE = 0.01;

type Scoring = NonNullable<Reading["mock"]>["scoring"];

function toWords(name: string): string[] {
  return normalizeString(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Whole words, so "Paper I" never matches "Paper II". */
function namesPart({ name, names }: { name: string | null; names: readonly string[] }): boolean {
  const words = toWords(name ?? "");

  return names.some((alternative) => {
    const wanted = toWords(alternative);

    return words.some((_, start) => wanted.every((word, offset) => words[start + offset] === word));
  });
}

function isSameMinimum(read: PointsMinimum | null | undefined, wanted: PointsMinimum | null) {
  return wanted === null
    ? !read
    : read?.unit === wanted.unit && Math.abs(read.value - wanted.value) < PENALTY_TOLERANCE;
}

function countRowQuestions({ part, scoring }: { part: string; scoring: Scoring | null }) {
  return (scoring?.marking ?? [])
    .filter((row) => row.part === part)
    .reduce((sum, row) => sum + (row.questions ?? 0), 0);
}

function hasScoredPart({
  fact,
  scoring,
}: {
  fact: Extract<ExpectedFact, { kind: "scoredPart" }>;
  scoring: Scoring | null;
}): boolean {
  return (scoring?.parts ?? []).some(
    (part) =>
      namesPart({ name: part.name, names: fact.part }) &&
      (fact.maxPoints === undefined || part.maxPoints === fact.maxPoints) &&
      (fact.minimum === undefined || isSameMinimum(part.minimum, fact.minimum)) &&
      (fact.qualifying === undefined || part.qualifying === fact.qualifying) &&
      (fact.questions === undefined ||
        part.questions === fact.questions ||
        countRowQuestions({ part: part.name, scoring }) === fact.questions),
  );
}

function hasMarkingRow({
  fact,
  scoring,
}: {
  fact: Extract<ExpectedFact, { kind: "markingRow" }>;
  scoring: Scoring | null;
}): boolean {
  const penalty = scoring?.wrongPenalty ?? null;

  return (scoring?.marking ?? []).some(
    (row) =>
      namesPart({ name: row.part, names: fact.part }) &&
      row.points === fact.points &&
      (fact.wrongPoints === undefined ||
        Math.abs(
          (getMarkingPenalty(row) ?? penalty ?? 0) -
            (getMarkingPenalty({ points: fact.points, wrongPoints: fact.wrongPoints }) ?? 0),
        ) < PENALTY_TOLERANCE),
  );
}

function hasFinalShare({
  fact,
  scoring,
}: {
  fact: Extract<ExpectedFact, { kind: "finalShare" }>;
  scoring: Scoring | null;
}): boolean {
  return (scoring?.finalShares ?? []).some(
    (share) =>
      share.parts.length === fact.parts.length &&
      fact.parts.every((name) =>
        share.parts.some((part) => namesPart({ name: part, names: [name] })),
      ) &&
      Math.abs(share.share - fact.share) < PENALTY_TOLERANCE,
  );
}

function isPointsFactFound({
  fact,
  scoring,
}: {
  fact: Extract<MockFact, { kind: "finalShare" | "markingRow" | "scoredPart" | "totalMinimum" }>;
  scoring: Scoring | null;
}): boolean {
  switch (fact.kind) {
    case "finalShare":
      return hasFinalShare({ fact, scoring });
    case "markingRow":
      return hasMarkingRow({ fact, scoring });
    case "scoredPart":
      return hasScoredPart({ fact, scoring });
    case "totalMinimum":
      return isSameMinimum(scoring?.totalMinimum, fact.minimum);
    default:
      return false;
  }
}

function isScoringFactFound({
  fact,
  scoring,
}: {
  fact: ScoringFact;
  scoring: NonNullable<Reading["mock"]>["scoring"] | null;
}): boolean {
  switch (fact.kind) {
    case "scoring":
      return scoring?.method === fact.method;
    case "wrongPenalty":
      return scoring?.wrongPenalty === fact.value;
    case "scale":
      return scoring?.scale?.min === fact.min && scoring.scale.max === fact.max;
    case "finalShare":
    case "markingRow":
    case "scoredPart":
    case "totalMinimum":
      return isPointsFactFound({ fact, scoring });
    default:
      return false;
  }
}

function sameValue<T>(wanted: T | undefined, found: T | null | undefined): boolean {
  return wanted === undefined || (found ?? null) === wanted;
}

function hasLanguageRule(fact: WrittenTaskFact, grading: WrittenGrading | null | undefined) {
  const language = grading?.language ?? null;

  if (fact.language === undefined || fact.language === null) {
    return fact.language === undefined || language === null;
  }

  return language?.method === fact.language.method && language.factor === fact.language.factor;
}

type WritingSheet = Parameters<typeof isComputableSheet>[0]["grading"];

const NO_CITATION = { citation: { passage: "", sourceId: "" }, text: "" };

/** A reading's sheet in the stored shape, so both sides are judged by the same arithmetic. */
function toStoredSheet(grading: WrittenGrading): WritingSheet {
  const unheld = grading.combination?.method === "other" || (grading.deductions?.length ?? 0) > 0;

  return {
    ...grading,
    combination:
      grading.combination?.method === "sum" || grading.combination?.method === "mean"
        ? { ...grading.combination, method: grading.combination.method, ...NO_CITATION }
        : null,
    criteria: grading.criteria.map(({ awards, parts: _parts, weight, ...criterion }) => ({
      ...criterion,
      ...NO_CITATION,
      ...(awards?.length && {
        awards: awards.map(({ count: _count, points, pointsHigh }) => ({
          points,
          ...(typeof pointsHigh === "number" && { pointsHigh }),
          ...NO_CITATION,
        })),
      }),
      ...(typeof weight === "number" && { weight }),
    })),
    language: grading.language && {
      ...grading.language,
      method:
        grading.language.method === "perError" || grading.language.method === "errorsPerLine"
          ? grading.language.method
          : "other",
      ...NO_CITATION,
    },
    limits: grading.limits?.map((limit) => ({ ...limit, ...NO_CITATION })),
    rounding: grading.rounding && { ...grading.rounding, ...NO_CITATION },
    totalSuppressed: grading.totalSuppressed || unheld,
    zeroing: [],
  };
}

function hasTotal({ grading, points }: { grading: WrittenGrading; points: number | null }) {
  return isComputableSheet({ grading: toStoredSheet(grading), points });
}

function readScales(grading: WrittenGrading): (number[] | null)[] {
  return grading.criteria.map(({ awards }) =>
    awards?.length ? awards.map(({ points }) => points ?? -1) : null,
  );
}

function hasZeroKinds(fact: WrittenTaskFact, grading: WrittenGrading | null | undefined): boolean {
  const kinds = new Set(grading?.zeroing.flatMap((rule) => rule.kinds ?? []));
  return (fact.zeroKinds ?? []).every((kind) => kinds.has(kind));
}

function sumPoints(grading: WrittenGrading | null | undefined): number {
  return (grading?.criteria ?? []).reduce((sum, { points }) => sum + (points ?? 0), 0);
}

function hasSheetShape(fact: WrittenTaskFact, grading: WrittenGrading | null | undefined) {
  const combination = grading?.combination?.method ?? null;

  const counted = (grading?.criteria ?? []).reduce(
    (sum, { parts }) => sum + (parts?.length ?? 0),
    0,
  );

  return (
    (fact.combination === undefined || combination === fact.combination) &&
    (fact.criteriaTotal === undefined ||
      Math.abs(sumPoints(grading) - fact.criteriaTotal) < POINT_TOLERANCE) &&
    (fact.limits === undefined || (grading?.limits?.length ?? 0) >= fact.limits) &&
    (fact.parts === undefined || counted === fact.parts) &&
    (fact.scales === undefined ||
      JSON.stringify(grading ? readScales(grading) : []) === JSON.stringify(fact.scales)) &&
    hasZeroKinds(fact, grading)
  );
}

const POINT_TOLERANCE = 0.001;

function hasGrading(fact: WrittenTaskFact, task: WrittenTask): boolean {
  const grading = task.grading ?? null;
  const points = grading?.criteria.map((criterion) => criterion.points) ?? [];

  return (
    (fact.total === undefined ||
      (grading !== null && hasTotal({ grading, points: task.points ?? null })) === fact.total) &&
    (fact.criterionPoints === undefined ||
      JSON.stringify(points) === JSON.stringify(fact.criterionPoints)) &&
    hasSheetShape(fact, grading) &&
    hasLanguageRule(fact, grading) &&
    (fact.rounding === undefined || Boolean(grading?.rounding) === fact.rounding) &&
    (fact.zeroing === undefined || (grading?.zeroing.length ?? 0) > 0 === fact.zeroing)
  );
}

function drawsOn({
  fact,
  reading,
  task,
}: {
  fact: WrittenTaskFact;
  reading: Reading;
  task: WrittenTask;
}): boolean {
  if (fact.drawsOn === undefined) {
    return true;
  }

  const found = findTaskSubjects({ names: task.subjects ?? [], subjects: reading.subjects });

  if (fact.drawsOn === null) {
    return found.length === 0;
  }

  const wanted = normalizeString(fact.drawsOn);

  const group = reading.subjects.filter((subject) =>
    normalizeString(subject.group ?? "").includes(wanted),
  );

  return (
    group.length > 0 &&
    found.length === group.length &&
    group.every((subject) => found.includes(subject))
  );
}

function hasWrittenTask({ fact, reading }: { fact: WrittenTaskFact; reading: Reading }): boolean {
  return (reading.mock?.sections ?? [])
    .filter((section) => section.kind === "written")
    .flatMap((section) => section.tasks ?? [])
    .some(
      (task) =>
        sameValue(fact.count, task.count) &&
        sameValue(fact.lines, task.lines) &&
        sameValue(fact.points, task.points) &&
        sameValue(fact.handwritten, task.handwritten) &&
        hasGrading(fact, task) &&
        drawsOn({ fact, reading, task }),
    );
}

function hasSharedClock(reading: Reading): boolean {
  const sections = reading.mock?.sections ?? [];

  return sections.some(
    (written) =>
      written.kind === "written" &&
      sections.some(
        (other) =>
          other.kind === "objective" &&
          other.day === written.day &&
          normalizeString(other.name) === normalizeString(written.name),
      ),
  );
}

function isMockFactFound({ fact, reading }: { fact: MockFact; reading: Reading }): boolean {
  if (isScoringFact(fact)) {
    return isScoringFactFound({ fact, scoring: reading.mock?.scoring ?? null });
  }

  const sections = reading.mock?.sections ?? [];

  switch (fact.kind) {
    case "section":
      return hasSection({ fact, reading });
    case "listeningParts":
      return hasListeningParts({ fact, reading });
    case "breakAfter":
      return sections.some((section) => section.breakAfterMinutes === fact.minutes);
    case "session":
      return sections.some((section) =>
        normalizeString(section.session ?? "").includes(normalizeString(fact.mentions)),
      );
    case "sharedClock":
      return hasSharedClock(reading);
    case "writtenTask":
      return hasWrittenTask({ fact, reading });
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

/** Math, a worked example or a "term: explanation" line is a line of notes, not an idea's name. */
const COPIED_LINE = /[$\\=]|^ex(?:emplo)?\b|:\s*\S/iu;

const isCopiedLine = (topic: string) => COPIED_LINE.test(topic);

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
      return fact.in === "mock"
        ? reading.mock?.totalQuestions === fact.value
        : getQuestionTotals(reading).includes(fact.value);
    case "subject":
      return reading.subjects.some(
        (subject) =>
          normalizeString(subject.name).includes(normalizeString(fact.name)) &&
          (fact.questions === undefined || subject.questions === fact.questions),
      );
    case "topic":
      return (fact.subject ? [findSubject({ name: fact.subject, reading })] : reading.subjects)
        .flatMap((subject) => subject?.topics ?? [])
        .some((topic) => normalizeString(topic) === normalizeString(fact.topic));
    case "shortTopics":
      return reading.subjects.every((subject) => !subject.topics.some(isCopiedLine));
    case "group":
      return normalizeString(findSubject({ name: fact.subject, reading })?.group ?? "").includes(
        normalizeString(fact.group),
      );
    case "choice":
      return hasChoice({ fact, reading });
    case "groupedSubjects":
      return hasGroupedSubjects({ fact, reading });
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
    choiceGroups: kept.structure.choiceGroups,
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
  name: "Extract exam blueprint",
  priorities: {
    distribution: "shared",
    first: "quality",
    reads: "Code stores the exam's blueprint, which planning and items use",
    reason: "A fact left out is lost to every learner of the exam",
    waits: "A learner waits on a new exam; refreshes run in the background",
  },
  score: scoreExtraction,
  testCases: TEST_CASES,
};
