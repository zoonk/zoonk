import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { type Citation } from "./blueprint-contract";
import { type ExtractionDocument, type Passage, toClaimSource } from "./blueprint-passages";

export const FORMAT_WORDS: Record<BlueprintExtraction["formats"][number]["kind"], string> = {
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

export function describePoints(points: number): string {
  return `${points} ${points === 1 ? "point" : "points"}`;
}

/**
 * A settled claim is kept once its passage is found, without the cited-fact check: a learner's own
 * notes cover the subjects they name, and a rare refusal would leave them without a plan.
 */
type Claim = { id: string; settled?: boolean; statement: string };

export type FactEntry = Claim & { citations: Citation[]; found: boolean };

export type FactSource = {
  documents: ExtractionDocument[];
  extraction: BlueprintExtraction;
  found: Passage[];
  /** The learner's own material (notes, slides, an old exam) rather than an exam's notice. */
  material?: boolean;
};

export function toFacts({
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
