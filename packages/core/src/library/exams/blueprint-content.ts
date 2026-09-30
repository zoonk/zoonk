import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { type ReusePolicy } from "../sources/source-contract";
import { type BlueprintContent, type Citation, type ExamStructure } from "./blueprint-contract";
import { type FactEntry, findStatedTopics } from "./blueprint-facts";
import { type ExtractionDocument } from "./blueprint-passages";

type Extraction = BlueprintExtraction;
type MockConditions = NonNullable<ExamStructure["mock"]>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const CLOCK_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

/** The claims both checks kept, by id, with their citations. */
type KeptFacts = Map<string, Citation[]>;

function toKeptFacts({
  facts,
  supportedIds,
}: {
  facts: FactEntry[];
  supportedIds: string[];
}): KeptFacts {
  const supported = new Set(supportedIds);

  return new Map(
    facts
      .filter((item) => item.found && supported.has(item.id))
      .map((item) => [item.id, item.citations]),
  );
}

/** A detail's value when its own claim was kept; otherwise a gap, never a guess. */
function keptOr<T, TGap>({
  gap,
  id,
  kept,
  value,
}: {
  gap: TGap;
  id: string;
  kept: KeptFacts;
  value: T;
}): T | TGap {
  return kept.has(id) ? value : gap;
}

/** Items of a list whose own claim was kept, with that claim's first citation. */
function keepItems<T>({ items, kept, prefix }: { items: T[]; kept: KeptFacts; prefix: string }) {
  return items.flatMap((item, index) => {
    const id = `${prefix}.${index}`;
    const found = kept.get(id)?.[0];
    return found ? [{ found, id, item }] : [];
  });
}

function isValidDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

/** A start time the check kept is stored only when it reads as a clock time. */
function toStartTime(value: string | null): string | null {
  return value && CLOCK_TIME_PATTERN.test(value) ? value : null;
}

/** The notice's clock, only when it names a real IANA zone. */
function toTimeZone(value: string | null): string | null {
  return value && isValidTimeZone(value) ? value : null;
}

/**
 * Sections only as a whole: a mock missing one of the exam's sections would misrepresent it.
 * Days too, since a mock splits its sections by day.
 */
function toSections({ kept, mock }: { kept: KeptFacts; mock: NonNullable<Extraction["mock"]> }) {
  const ids = mock.sections.map((_, index) => `mock.sections.${index}`);

  if (!ids.every((id) => kept.has(id))) {
    return [];
  }

  const daysKept = mock.sections.every(
    (section, index) => section.day === null || kept.has(`${ids[index]}.day`),
  );

  return mock.sections.map((section, index) => ({
    day: daysKept ? section.day : null,
    minutes: keptOr({ gap: null, id: `${ids[index]}.minutes`, kept, value: section.minutes }),
    name: section.name,
    questions: keptOr({ gap: null, id: `${ids[index]}.questions`, kept, value: section.questions }),
  }));
}

/** The exam's scoring when its claim was kept; otherwise "other" with no description: unknown. */
function toScoring({ kept, mock }: { kept: KeptFacts; mock: NonNullable<Extraction["mock"]> }) {
  const { description, method } = mock.scoring;

  if (!kept.has("mock.scoring")) {
    return { description: "", method: "other" as const };
  }

  return {
    description:
      method === "other"
        ? description
        : keptOr({ gap: "", id: "mock.scoring.description", kept, value: description }),
    method,
  };
}

/**
 * The mock's conditions when its scoring, sections, time or length was kept, each a gap when its
 * own claim wasn't: a mock can copy an exam's sections and time without knowing how it's scored.
 */
function toMock({ extraction, kept }: { extraction: Extraction; kept: KeptFacts }) {
  const { mock } = extraction;
  const citations = [...kept.entries()].find(([id]) => id.startsWith("mock."))?.[1];

  if (!mock || !citations) {
    return null;
  }

  const conditions = {
    adaptive: mock.adaptive && kept.has("mock.adaptive"),
    citations,
    order: keptOr({ gap: null, id: "mock.order", kept, value: mock.order }),
    scoring: toScoring({ kept, mock }),
    sections: toSections({ kept, mock }),
    timeLimitMinutes: keptOr({
      gap: null,
      id: "mock.timeLimitMinutes",
      kept,
      value: mock.timeLimitMinutes,
    }),
    totalQuestions: keptOr({
      gap: null,
      id: "mock.totalQuestions",
      kept,
      value: mock.totalQuestions,
    }),
  } satisfies MockConditions;

  const known =
    kept.has("mock.scoring") ||
    conditions.sections.length > 0 ||
    conditions.timeLimitMinutes !== null ||
    conditions.totalQuestions !== null;

  return known ? conditions : null;
}

function toStructure({
  documents,
  extraction,
  kept,
}: {
  documents: ExtractionDocument[];
  extraction: Extraction;
  kept: KeptFacts;
}): ExamStructure {
  return {
    formats: keepItems({ items: extraction.formats, kept, prefix: "formats" }).map(
      ({ found, id, item }) => ({
        citation: found,
        description:
          item.kind === "other"
            ? item.description
            : keptOr({ gap: "", id: `${id}.description`, kept, value: item.description }),
        kind: item.kind,
        options: item.options,
      }),
    ),
    mock: toMock({ extraction, kept }),
    rules: keepItems({ items: extraction.rules, kept, prefix: "rules" }).map(({ found, item }) => ({
      citation: found,
      text: item.text,
    })),
    subjects: keepItems({ items: extraction.subjects, kept, prefix: "subjects" }).map(
      ({ found, id, item }) => ({
        citation: found,
        name: item.name,
        questions: keptOr({ gap: null, id: `${id}.questions`, kept, value: item.questions }),
        topics: findStatedTopics({ documents, subject: item }),
        weight: keptOr({ gap: null, id: `${id}.weight`, kept, value: item.weight }),
      }),
    ),
  };
}

/**
 * Builds the blueprint from the claims both checks kept. A dropped claim leaves a gap, never a
 * guess: a subject without a kept question count has none, and the caller asks the learner for
 * the notice when too little is left.
 */
export function toBlueprintContent({
  documents,
  extraction,
  facts,
  noticeUrl,
  sourceHash,
  supportedIds,
}: {
  documents: ExtractionDocument[];
  extraction: BlueprintExtraction;
  facts: FactEntry[];
  noticeUrl: string | null;
  sourceHash: string;
  supportedIds: string[];
}): BlueprintContent {
  const kept = toKeptFacts({ facts, supportedIds });
  const { edition } = extraction;

  return {
    edition: {
      citations: kept.get("edition.year") ?? kept.get("edition.questionCount") ?? [],
      dates: keepItems({ items: extraction.dates, kept, prefix: "dates" })
        .filter(({ item }) => isValidDate(item.date))
        .map(({ found, id, item }) => ({
          citation: found,
          date: item.date,
          kind: item.kind,
          label: item.label,
          startTime: keptOr({
            gap: null,
            id: `${id}.startTime`,
            kept,
            value: toStartTime(item.startTime),
          }),
        })),
      noticeUrl,
      questionCount: keptOr({
        gap: null,
        id: "edition.questionCount",
        kept,
        value: edition.questionCount,
      }),
      sourceHash,
      timeZone: toTimeZone(edition.timeZone),
      year: keptOr({ gap: null, id: "edition.year", kept, value: edition.year }),
    },
    structure: toStructure({ documents, extraction, kept }),
    topicFrequency: keepItems({
      items: extraction.topicFrequency,
      kept,
      prefix: "topicFrequency",
    }).map(({ found, item }) => ({
      appearances: item.appearances,
      basis: item.basis,
      citation: found,
      level: item.level,
      subject: item.subject,
      topic: item.topic,
    })),
  };
}

/**
 * Enough to plan from: what the exam covers, or how and when it's taken.
 * Anything less means the documents weren't the notice, and the learner is
 * asked to upload it.
 */
export function isUsableBlueprint(content: BlueprintContent): boolean {
  const { edition, structure } = content;

  return structure.subjects.length > 0 || (structure.mock !== null && edition.dates.length > 0);
}

/**
 * The organizer's own terms about reusing its questions, when a document states
 * them and both checks kept that fact. Boards whose terms were checked by hand
 * keep their stored policy.
 */
export function toReusePolicy({
  extraction,
  facts,
  supportedIds,
}: {
  extraction: BlueprintExtraction;
  facts: FactEntry[];
  supportedIds: string[];
}): { policy: ReusePolicy; sourceId: string } | null {
  const citation = toKeptFacts({ facts, supportedIds }).get("reusePolicy")?.[0];
  const { pastQuestions } = extraction.reusePolicy;

  if (!citation || pastQuestions === "unknown") {
    return null;
  }

  return {
    policy: { basis: citation.passage, honorTakedowns: true, pastQuestions, termsUrl: null },
    sourceId: citation.sourceId,
  };
}
