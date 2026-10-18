import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type Citation } from "./blueprint-contract";
import { type ExtractionDocument, type Passage, toClaimSource } from "./blueprint-passages";

/**
 * One claim the model check judges against its passages, and whether code found every passage
 * in the document it cites.
 */
export type FactEntry = { citations: Citation[]; found: boolean; id: string; statement: string };

type Claim = { id: string; statement: string };

/** What every group of claims is built from, with the passages code found in their documents. */
export type FactSource = {
  documents: ExtractionDocument[];
  extraction: BlueprintExtraction;
  found: Passage[];
};

/** Claims that share their passages, each judged on its own so one wrong detail drops only itself. */
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
