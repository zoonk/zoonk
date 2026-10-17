import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type Citation } from "./blueprint-contract";
import { findNamesInDocument, isPassageInDocument } from "./passage-check";

/** A document as research numbered it for the model (from 1), with the source it's stored as. */
export type ExtractionDocument = { sourceId: string; text: string | null };

/** A passage the extraction quoted, with the number of the document it quoted it from. */
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

  // Without text (a scanned PDF, a photo) code can't look for the passage; the model check still runs.
  const found = document.text
    ? isPassageInDocument({ passage: passage.passage, text: document.text })
    : true;

  return { citation: { passage: passage.passage, sourceId: document.sourceId }, found };
}

/** Where a group of claims came from, checked once for all of them. */
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

/** The passage a format quotes for how it's marked, when apart from its own (`markingPassage`). */
export function listMarkingPassages(format: FormatPassages): Passage[] {
  return format.markingPassage
    ? [{ document: format.document, passage: format.markingPassage }]
    : [];
}

/** The passage a format quotes for how many questions take it, when apart from its own. */
export function listCountPassages(format: FormatPassages): Passage[] {
  return format.countPassage ? [{ document: format.document, passage: format.countPassage }] : [];
}

/** Every passage an extraction quotes, in the order research numbered its parts. */
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

/** Each passage once, in order: a claim reads its own and its part's, which can repeat. */
export function uniquePassages(passages: Passage[]): Passage[] {
  return [...new Map(passages.map((passage) => [toPassageKey(passage), passage])).values()];
}

/** The extraction's passages code found in their documents, each once. */
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

/**
 * Whether a passage names a part of the exam: every word of the name, in any order, since a
 * notice writes "the discursive test (P4)" where the extraction names the part "(P4) Discursive".
 */
function namesPart({ name, passage }: { name: string; passage: string }): boolean {
  const words = new Set(name.match(WORD_PATTERN));

  return (
    words.size > 0 && findNamesInDocument({ names: [...words], text: passage }).size === words.size
  );
}

/**
 * The passages a subject's or section's claims read: its own, then every other found passage
 * that names it. A notice states a part's label, count or length wherever it likes, and the
 * extraction often quoted that place for a sibling (the mock's table, a format, a subject). The
 * check reads each claim apart from its siblings, so each claim carries the passage that states it.
 */
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
