import { type CitedFact } from "@zoonk/ai/tasks/v2/research/check-cited-facts";
import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type FormatCount } from "@zoonk/ai/tasks/v2/research/extract-question-formats";
import { type PartialCreditRule } from "@zoonk/ai/tasks/v2/research/partial-credit";
import { splitEvenly } from "@zoonk/utils/split-evenly";
import { type FactEntry, type FactSource, toFacts } from "./blueprint-fact-claims";
import { testedLanguageFacts } from "./blueprint-language";
import { mockFacts } from "./blueprint-mock-facts";
import {
  type ExtractionDocument,
  type Passage,
  listCountPassages,
  listFoundPassages,
  listMarkingPassages,
  toPartPassages,
} from "./blueprint-passages";
import { findNamesInDocument } from "./passage-check";

type Extraction = BlueprintExtraction;

const FORMAT_WORDS: Record<Extraction["formats"][number]["kind"], string> = {
  essay: "a written answer in the candidate's own words, such as an essay or a discursive question",
  multipleChoice:
    "multiple-choice questions, answered by picking among given options or by picking words or items in a text",
  numeric: "questions answered with a number",
  oral: "an oral exam",
  other: "other questions",
  practical: "a practical test",
  shortAnswer:
    "questions answered by writing or typing a short answer, such as a word, a value, a sentence, or a table or blank to fill in",
  trueFalse: "items judged true or false (right or wrong)",
};

function nameFormat(format: Pick<Extraction["formats"][number], "kind" | "passage">): string {
  return `${FORMAT_WORDS[format.kind]} ("${format.passage}")`;
}

const DATE_WORDS: Record<Extraction["dates"][number]["kind"], string> = {
  exam: "The exam takes place",
  other: "An event of the exam",
  registrationEnd: "Registration closes",
  registrationStart: "Registration opens",
  results: "Results come out",
};

const PERCENT = 100;

function describeParts(parts: (string | false | null)[]): string {
  return parts.filter(Boolean).join("; ");
}

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
        Boolean(subject.choiceGroup) && {
          id: `${id}.choiceGroup`,
          statement: `${name} is one of the options of "${subject.choiceGroup}", of which each candidate takes only one`,
        },
        Boolean(subject.partOf) && {
          id: `${id}.partOf`,
          statement: `${name}'s questions are part of "${subject.partOf}"`,
        },
      ],
      documents,
      passages: toPartPassages({ found, name: subject.name, own: subject.passages }),
    });
  });
}

const PARTIAL_CREDIT_WORDS: Record<PartialCreditRule, string> = {
  allOrNothing: "only picking all the right options and no wrong one earns a question's marks",
  perOption:
    "each right option picked earns part of the marks while no wrong option is picked, all of them the full marks, and a wrong pick loses marks",
  perRightPick:
    "each right option picked earns its share of the marks while no wrong option is picked",
  plusMinus: "each right pick earns a mark and each wrong pick loses one",
};

function partialCreditFacts({
  documents,
  extraction,
  format,
  id,
}: Omit<FactSource, "found"> & { format: Extraction["formats"][number]; id: string }): FactEntry[] {
  const rule = format.select && format.select !== 1 ? format.partialCredit : null;

  return rule
    ? toFacts({
        claims: [
          {
            id: `${id}.partialCredit`,
            statement: `In ${nameFormat(format)} that ask for several options, ${PARTIAL_CREDIT_WORDS[rule]}`,
          },
        ],
        documents,
        passages: [format, ...listMarkingPassages(format), ...(extraction.mock?.passages ?? [])],
      })
    : [];
}

const COUNT_PART_WORDS: Record<FormatCount["per"], string> = {
  exam: "in the exam",
  paper: "in each paper",
  section: "in its section",
  subject: "in each subject",
};

function countFacts({
  documents,
  format,
  id,
}: Omit<FactSource, "extraction" | "found"> & {
  format: Extraction["formats"][number];
  id: string;
}): FactEntry[] {
  const { count } = format;

  if (!count || count.value <= 0) {
    return [];
  }

  const kind = nameFormat(format);
  const part = COUNT_PART_WORDS[count.per];

  return toFacts({
    claims: [
      {
        id: `${id}.count`,
        statement:
          count.unit === "percent"
            ? `Share of the questions ${part} that are ${kind}: about ${count.value}%`
            : `Number of ${kind} ${part}: ${count.value}`,
      },
    ],
    documents,
    passages: [format, ...listCountPassages(format)],
  });
}

function formatFacts({ documents, extraction }: FactSource): FactEntry[] {
  return extraction.formats.flatMap((format, index) => {
    const id = `formats.${index}`;
    const options = format.options === null ? "" : `, ${format.options} options each`;
    const isOther = format.kind === "other";

    const claims = toFacts({
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

    return [
      ...claims,
      ...partialCreditFacts({ documents, extraction, format, id }),
      ...countFacts({ documents, format, id }),
    ];
  });
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
    ...testedLanguageFacts(source),
    ...reusePolicyFacts(source),
  ];
}

/** Checking many claims at once can exhaust the model's output budget. */
const CHECK_BATCH_SIZE = 16;

export function toCheckBatches(facts: CitedFact[]): CitedFact[][] {
  return splitEvenly({ items: facts, size: CHECK_BATCH_SIZE });
}

export function toCitedFacts(facts: FactEntry[]): CitedFact[] {
  return facts
    .filter((item) => item.found)
    .map((item) => ({
      id: item.id,
      passage: item.citations.map((citation) => citation.passage).join(" … "),
      statement: item.statement,
    }));
}

/** Without searchable document text, topics rely on the model's reading. */
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
