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

export type FactEntry = { citations: Citation[]; found: boolean; id: string; statement: string };

type Claim = { id: string; statement: string };

export type FactSource = {
  documents: ExtractionDocument[];
  extraction: BlueprintExtraction;
  found: Passage[];
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
