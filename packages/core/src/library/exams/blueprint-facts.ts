import { type CitedFact } from "@zoonk/ai/tasks/v2/research/check-cited-facts";
import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { splitEvenly } from "@zoonk/utils/split-evenly";
import { type Citation } from "./blueprint-contract";
import {
  type ExtractionDocument,
  type Passage,
  listFoundPassages,
  toClaimSource,
  toPartPassages,
} from "./blueprint-passages";
import { findNamesInDocument } from "./passage-check";

/**
 * One claim the model check judges against its passages, and whether code found every passage
 * in the document it cites.
 */
export type FactEntry = { citations: Citation[]; found: boolean; id: string; statement: string };

type Extraction = BlueprintExtraction;
type Mock = NonNullable<Extraction["mock"]>;

const FORMAT_WORDS: Record<Extraction["formats"][number]["kind"], string> = {
  essay: "a written answer in the candidate's own words, such as an essay or a discursive question",
  multipleChoice: "multiple-choice questions",
  numeric: "questions answered with a number",
  oral: "an oral exam",
  other: "other questions",
  practical: "a practical test",
  shortAnswer:
    "questions answered in writing with a short answer, such as a word, a value or a table or blank to fill in",
  trueFalse: "items judged true or false (right or wrong)",
};

const SCORING_WORDS: Record<Exclude<Mock["scoring"]["method"], "other">, string> = {
  itemResponseTheory: "scored with item response theory",
  raw: "the score is the number or share of right answers",
  scaled: "the result is reported on a score scale, such as bands or points",
  wrongCancelsRight: "a wrong answer cancels a right one",
};

const DATE_WORDS: Record<Extraction["dates"][number]["kind"], string> = {
  exam: "The exam takes place",
  other: "An event of the exam",
  registrationEnd: "Registration closes",
  registrationStart: "Registration opens",
  results: "Results come out",
};

const PERCENT = 100;

type Claim = { id: string; statement: string };

/** What every group of claims is built from, with the passages code found in their documents. */
type FactSource = { documents: ExtractionDocument[]; extraction: Extraction; found: Passage[] };

/** Claims that share their passages, each judged on its own so one wrong detail drops only itself. */
function toFacts({
  claims,
  documents,
  passages,
}: {
  claims: (Claim | false)[];
  documents: ExtractionDocument[];
  passages: Passage[];
}): FactEntry[] {
  const source = toClaimSource({ documents, passages });

  return claims.filter((claim) => claim !== false).map((claim) => ({ ...claim, ...source }));
}

function describeParts(parts: (string | false | null)[]): string {
  return parts.filter(Boolean).join("; ");
}

/**
 * A subject is kept when its passages name it; its question count, weight and group are claims of
 * their own, often stated elsewhere in the notice. Its topics are checked by code
 * (`findStatedTopics`).
 */
function subjectFacts({ documents, extraction, found }: FactSource): FactEntry[] {
  return extraction.subjects.flatMap((subject, index) => {
    const id = `subjects.${index}`;
    const name = `Subject "${subject.name}"`;

    return toFacts({
      claims: [
        { id, statement: name },
        subject.questions !== null && {
          id: `${id}.questions`,
          statement: `${name} has ${subject.questions} questions`,
        },
        subject.weight !== null && {
          id: `${id}.weight`,
          statement: `${name} is worth ${Math.round(subject.weight * PERCENT)}% of the final score`,
        },
        Boolean(subject.group) && {
          id: `${id}.group`,
          statement: `${name} is part of "${subject.group}"`,
        },
      ],
      documents,
      passages: toPartPassages({ found, name: subject.name, own: subject.passages }),
    });
  });
}

/** A format is kept by its kind; its description, written by the model, is a claim of its own. */
function formatFacts({ documents, extraction }: FactSource): FactEntry[] {
  return extraction.formats.flatMap((format, index) => {
    const id = `formats.${index}`;
    const options = format.options === null ? "" : `, ${format.options} options each`;
    const isOther = format.kind === "other";

    return toFacts({
      claims: [
        {
          id,
          statement: `Question format: ${isOther ? format.description : FORMAT_WORDS[format.kind]}${options}`,
        },
        !isOther && {
          id: `${id}.description`,
          statement: `Question format: ${format.description}`,
        },
      ],
      documents,
      passages: [format],
    });
  });
}

function describeScoring(scoring: Mock["scoring"]): string {
  return scoring.method === "other" ? scoring.description : SCORING_WORDS[scoring.method];
}

/** A section's claims read the mock's passages and those naming the section, like a subject's. */
function sectionFacts({
  documents,
  found,
  mock,
}: {
  documents: ExtractionDocument[];
  found: Passage[];
  mock: Mock;
}): FactEntry[] {
  return mock.sections.flatMap((section, index) => {
    const id = `mock.sections.${index}`;
    const name = `Exam section "${section.name}"`;

    return toFacts({
      claims: [
        { id, statement: name },
        section.questions !== null && {
          id: `${id}.questions`,
          statement: `${name} has ${section.questions} questions`,
        },
        section.minutes !== null && {
          id: `${id}.minutes`,
          statement: `${name} lasts ${section.minutes} minutes`,
        },
        section.day !== null && {
          id: `${id}.day`,
          statement: `${name} is on exam day ${section.day}`,
        },
        ...(section.tasks ?? []).map((task, taskIndex) => ({
          id: `${id}.tasks.${taskIndex}`,
          statement: `${name} asks ${task.count} × ${task.description}`,
        })),
      ],
      documents,
      passages: toPartPassages({ found, name: section.name, own: mock.passages }),
    });
  });
}

/**
 * The conditions a mock copies, one claim each: a notice states them in several places, and a
 * derived detail (a day's length given to one section) shouldn't drop the scoring with it.
 */
function mockFacts({ documents, extraction, found }: FactSource): FactEntry[] {
  const { mock } = extraction;

  if (!mock) {
    return [];
  }

  const conditions = toFacts({
    claims: [
      { id: "mock.scoring", statement: `Scoring: ${describeScoring(mock.scoring)}` },
      mock.scoring.method !== "other" && {
        id: "mock.scoring.description",
        statement: `Scoring: ${mock.scoring.description}`,
      },
      mock.totalQuestions !== null && {
        id: "mock.totalQuestions",
        statement: `The exam has ${mock.totalQuestions} questions in total`,
      },
      mock.timeLimitMinutes !== null && {
        id: "mock.timeLimitMinutes",
        statement: `The exam lasts ${mock.timeLimitMinutes} minutes in total`,
      },
      mock.order !== null && { id: "mock.order", statement: `The exam's order: ${mock.order}` },
      mock.adaptive && {
        id: "mock.adaptive",
        statement: "A later section's questions depend on the results of an earlier one",
      },
    ],
    documents,
    passages: mock.passages,
  });

  return [...conditions, ...sectionFacts({ documents, found, mock })];
}

function editionFacts({ documents, extraction }: FactSource): FactEntry[] {
  const { passages, questionCount, year } = extraction.edition;

  return toFacts({
    claims: [
      year !== null && { id: "edition.year", statement: `This is the exam's ${year} edition` },
      questionCount !== null && {
        id: "edition.questionCount",
        statement: `The exam has ${questionCount} questions in total`,
      },
    ],
    documents,
    passages,
  });
}

function singleFacts({ documents, extraction }: FactSource): FactEntry[] {
  const fact = (id: string, passage: Passage, statement: string) =>
    toFacts({ claims: [{ id, statement }], documents, passages: [passage] });

  return [
    ...extraction.rules.flatMap((rule, index) =>
      fact(`rules.${index}`, rule, `Rule: ${rule.text}`),
    ),
    ...extraction.dates.flatMap((date, index) =>
      toFacts({
        claims: [
          {
            id: `dates.${index}`,
            statement: `${DATE_WORDS[date.kind]} on ${date.date}: ${date.label}`,
          },
          date.startTime !== null && {
            id: `dates.${index}.startTime`,
            statement: `${date.label} on ${date.date} starts at ${date.startTime}`,
          },
        ],
        documents,
        passages: [date],
      }),
    ),
    ...extraction.topicFrequency.flatMap((item, index) =>
      fact(
        `topicFrequency.${index}`,
        item,
        describeParts([
          `Topic "${item.topic}" of "${item.subject}" appears ${item.level}: ${item.basis}`,
          item.appearances !== null && `${item.appearances} questions`,
        ]),
      ),
    ),
  ];
}

function reusePolicyFacts({ documents, extraction }: FactSource): FactEntry[] {
  const { document, passage, pastQuestions } = extraction.reusePolicy;

  if (pastQuestions === "unknown" || document === null || !passage) {
    return [];
  }

  const statement =
    pastQuestions === "allowedWithCitation"
      ? "The organizer allows reproducing its exam questions when the source is cited."
      : "The organizer doesn't allow reproducing its exam questions.";

  return toFacts({
    claims: [{ id: "reusePolicy", statement }],
    documents,
    passages: [{ document, passage }],
  });
}

/**
 * Every claim of an extraction in words, with its passages and whether code found them. Each
 * claim states one thing, so the model check drops a detail its passages don't state without
 * dropping the subject, format or scoring it belongs to. The check reads claims in batches, never
 * a sibling's passages, so each claim carries every passage that states it.
 */
export function listBlueprintFacts({
  documents,
  extraction,
}: {
  documents: ExtractionDocument[];
  extraction: BlueprintExtraction;
}): FactEntry[] {
  const source = { documents, extraction, found: listFoundPassages({ documents, extraction }) };

  return [
    ...subjectFacts(source),
    ...formatFacts(source),
    ...mockFacts(source),
    ...editionFacts(source),
    ...singleFacts(source),
    ...reusePolicyFacts(source),
  ];
}

/**
 * Claims one check reads. The check's reasoning grows with its claims (48 of TCDF's took 30,000
 * output tokens in one call), so claims are checked in batches at once.
 */
const CHECK_BATCH_SIZE = 16;

/** The cited facts in the batches the model check reads, one call each. */
export function toCheckBatches(facts: CitedFact[]): CitedFact[][] {
  return splitEvenly({ items: facts, size: CHECK_BATCH_SIZE });
}

/** Facts the model check reads: only those whose passages code found in the documents. */
export function toCitedFacts(facts: FactEntry[]): CitedFact[] {
  return facts
    .filter((item) => item.found)
    .map((item) => ({
      id: item.id,
      passage: item.citations.map((citation) => citation.passage).join(" … "),
      statement: item.statement,
    }));
}

/**
 * A subject's topics its own documents state word for word: the syllabus's item names, which
 * the extraction copies. A document without text (a photo, a scan) can't be searched, so its
 * topics stand on the model's reading, like its passages.
 */
export function findStatedTopics({
  documents,
  subject,
}: {
  documents: ExtractionDocument[];
  subject: Extraction["subjects"][number];
}): string[] {
  const numbers = new Set(subject.passages.map((passage) => passage.document));
  const cited = [...numbers].flatMap((number) => documents[number - 1] ?? []);

  if (cited.some((document) => !document.text)) {
    return subject.topics;
  }

  const stated = new Set(
    cited.flatMap((document) =>
      document.text ? [...findNamesInDocument({ names: subject.topics, text: document.text })] : [],
    ),
  );

  return subject.topics.filter((topic) => stated.has(topic));
}
