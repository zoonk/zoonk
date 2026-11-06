import "server-only";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type TransactionClient } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { toStoredItem } from "../../items/item-content";
import { type ScreenMathItem } from "../../steps/written-screens";

type ScreenQuestion = Extract<GeneratedItem, { format: "numeric" }>;

export function toScreenQuestion(mathItem: ScreenMathItem | null): ScreenQuestion | null {
  return mathItem && { ...mathItem, difficulty: "medium", format: "numeric", otherSolutions: [] };
}

export function parseScreenQuestion(stored: unknown): ScreenQuestion | null {
  return GENERATED_ITEM_SCHEMAS.numeric.nullable().parse(stored);
}

/** Adds a screen's question to the practice bank; returns null when there's none to add. */
export async function createQuestionItem(
  tx: TransactionClient,
  {
    language,
    provenance,
    question,
    skillId,
  }: {
    language: string;
    provenance: LibraryProvenance;
    question: ScreenQuestion | null;
    skillId: string | null;
  },
): Promise<string | null> {
  if (!question || !skillId) {
    return null;
  }

  const item = await tx.item.create({
    data: { ...toStoredItem(question), language, skillId, ...toProvenanceData(provenance) },
  });

  return item.id;
}
