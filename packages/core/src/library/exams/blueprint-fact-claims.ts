import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type Citation } from "./blueprint-contract";
import { type ExtractionDocument, type Passage, toClaimSource } from "./blueprint-passages";

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
