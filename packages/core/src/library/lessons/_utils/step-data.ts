import { type StepKind } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";

type LibraryStepInput = {
  position: number;
  kind: StepKind;
  /** Content already validated against the versioned step contract. */
  content: object;
  contractVersion?: number;
  skillId?: string | null;
  itemId?: string | null;
  wordId?: string | null;
  sentenceId?: string | null;
  mediaAssetId?: string | null;
  provenance: LibraryProvenance;
};

/** A step input as Prisma data, without the lesson and position that locate it. */
export function toStepData(step: LibraryStepInput) {
  return {
    content: step.content,
    contractVersion: step.contractVersion,
    itemId: step.itemId ?? null,
    kind: step.kind,
    mediaAssetId: step.mediaAssetId ?? null,
    sentenceId: step.sentenceId ?? null,
    skillId: step.skillId ?? null,
    wordId: step.wordId ?? null,
    ...toProvenanceData(step.provenance),
  };
}
