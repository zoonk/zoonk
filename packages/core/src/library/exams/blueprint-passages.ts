import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { type Citation } from "./blueprint-contract";
import { findNamesInDocument, isPassageInDocument } from "./passage-check";

export type ExtractionDocument = { sourceId: string; text: string | null };

export type Passage = { document: number; passage: string };

type BlueprintSubject = BlueprintExtraction["subjects"][number];

const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

function resolvePassage({
  documents,
  passage,
}: {
  documents: ExtractionDocument[];
  passage: Passage;
}) {
  const document = documents[passage.document - 1];

  if (!document) {
    return null;
  }

  const found = document.text
    ? isPassageInDocument({ passage: passage.passage, text: document.text })
    : true;

  return { citation: { passage: passage.passage, sourceId: document.sourceId }, found };
}

/** The name is in the document's own text, inside a passage quoted from it. */
function isNameQuoted({
  documents,
  name,
  passages,
}: {
  documents: ExtractionDocument[];
  name: string;
  passages: Passage[];
}): boolean {
  const names = [name];

  return passages.some(({ document, passage }) => {
    const text = documents[document - 1]?.text;

    if (!text) {
      return false;
    }

    return (
      isPassageInDocument({ passage, text }) &&
      findNamesInDocument({ names, text: passage }).size > 0 &&
      findNamesInDocument({ names, text }).size > 0
    );
  });
}

export function toClaimSource({
  documents,
  passages,
}: {
  documents: ExtractionDocument[];
  passages: Passage[];
}): { citations: Citation[]; found: boolean } {
  const resolved = passages.map((passage) => resolvePassage({ documents, passage }));
  const valid = resolved.filter((item) => item !== null);

  return {
    citations: valid.map((item) => item.citation),
    found:
      valid.length > 0 && valid.length === resolved.length && valid.every((item) => item.found),
  };
}

type FormatPassages = Pick<
  BlueprintExtraction["formats"][number],
  "countPassage" | "document" | "markingPassage"
>;

export function listMarkingPassages(format: FormatPassages): Passage[] {
  return format.markingPassage
    ? [{ document: format.document, passage: format.markingPassage }]
    : [];
}

export function listCountPassages(format: FormatPassages): Passage[] {
  return format.countPassage ? [{ document: format.document, passage: format.countPassage }] : [];
}

function listScoringPassages(
  scoring: NonNullable<BlueprintExtraction["mock"]>["scoring"] | undefined,
): Passage[] {
  if (!scoring) {
    return [];
  }

  return [
    ...scoring.marking.flatMap((row) => row.passages),
    ...scoring.parts.flatMap((part) => part.passages),
    ...(scoring.totalMinimum?.passages ?? []),
    ...scoring.finalShares.flatMap((share) => share.passages),
  ];
}

export function listExtractionPassages(extraction: BlueprintExtraction): Passage[] {
  const { document, passage } = extraction.reusePolicy;

  return [
    ...extraction.subjects.flatMap((subject) => subject.passages),
    ...extraction.choiceGroups.flatMap((group) => group.passages),
    ...extraction.formats.flatMap((format) => [
      format,
      ...listMarkingPassages(format),
      ...listCountPassages(format),
    ]),
    ...(extraction.mock?.passages ?? []),
    ...listScoringPassages(extraction.mock?.scoring),
    ...(extraction.mock?.sections ?? []).flatMap((section) => [
      ...section.passages,
      ...section.tasks.flatMap((task) => task.passages),
    ]),
    ...extraction.edition.passages,
    ...extraction.rules,
    ...extraction.dates,
    ...extraction.topicFrequency,
    ...(extraction.testedLanguage ? [extraction.testedLanguage] : []),
    ...(document !== null && passage ? [{ document, passage }] : []),
  ].map((item) => ({ document: item.document, passage: item.passage }));
}

function toPassageKey({ document, passage }: Passage): string {
  return `${document}:${passage}`;
}

export function uniquePassages(passages: Passage[]): Passage[] {
  return [...new Map(passages.map((passage) => [toPassageKey(passage), passage])).values()];
}

export function listFoundPassages({
  documents,
  extraction,
}: {
  documents: ExtractionDocument[];
  extraction: BlueprintExtraction;
}): Passage[] {
  const found = listExtractionPassages(extraction).filter(
    (passage) => resolvePassage({ documents, passage })?.found,
  );

  return uniquePassages(found);
}

function namesPart({ name, passage }: { name: string; passage: string }): boolean {
  const words = new Set(name.match(WORD_PATTERN));

  return (
    words.size > 0 && findNamesInDocument({ names: [...words], text: passage }).size === words.size
  );
}

export function toPartPassages({
  found,
  name,
  own,
}: {
  found: Passage[];
  name: string;
  own: Passage[];
}): Passage[] {
  return uniquePassages([
    ...own,
    ...found.filter((passage) => namesPart({ name, passage: passage.passage })),
  ]);
}

/** Without searchable document text, topics rely on the model's reading. */
export function findStatedTopics({
  documents,
  subject,
}: {
  documents: ExtractionDocument[];
  subject: BlueprintSubject;
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

function hasStatedTopic({
  documents,
  subject,
}: {
  documents: ExtractionDocument[];
  subject: BlueprintSubject;
}) {
  const cited = subject.passages.flatMap(({ document }) => documents[document - 1] ?? []);

  return (
    cited.length > 0 &&
    cited.every((document) => document.text) &&
    findStatedTopics({ documents, subject }).length > 0
  );
}

export function isInLearnerNotes({
  documents,
  subject,
}: {
  documents: ExtractionDocument[];
  subject: BlueprintSubject;
}) {
  return isNameQuoted({ documents, ...subject }) || hasStatedTopic({ documents, subject });
}
