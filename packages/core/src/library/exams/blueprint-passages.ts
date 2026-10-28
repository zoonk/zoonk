import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type Citation } from "./blueprint-contract";
import { findNamesInDocument, isPassageInDocument } from "./passage-check";

export type ExtractionDocument = { sourceId: string; text: string | null };

export type Passage = { document: number; passage: string };

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

export function listExtractionPassages(extraction: BlueprintExtraction): Passage[] {
  const { document, passage } = extraction.reusePolicy;

  return [
    ...extraction.subjects.flatMap((subject) => subject.passages),
    ...extraction.formats.flatMap((format) => [
      format,
      ...listMarkingPassages(format),
      ...listCountPassages(format),
    ]),
    ...(extraction.mock?.passages ?? []),
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
