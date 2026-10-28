import { type Goal, type ItemFormat } from "@zoonk/db";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getExamChoiceFormat } from "../../library/exams/exam-choice-format";
import { countRightAnswersToKnow } from "./placement-beliefs";

export type PlacementQuickFormat = "multipleChoice" | "trueFalse";

export function getPlacementQuickFormat(
  structure: Pick<ExamStructure, "formats"> | null,
): PlacementQuickFormat {
  return getExamChoiceFormat(structure)?.kind ?? "multipleChoice";
}

/** Only language goals confirm in writing; other goals use quick questions to avoid typing friction. */
export function confirmsInWriting(goal: Pick<Goal, "targetLanguage">): boolean {
  return goal.targetLanguage !== null;
}

/** Returns zero outside placement, when formats are narrowed, or when confirmation is written. */
export function getConfirmingCount({
  forPlacement,
  formats,
  quickFormat,
  writesTyped,
}: {
  forPlacement: boolean;
  formats?: readonly ItemFormat[];
  quickFormat: PlacementQuickFormat;
  writesTyped: boolean;
}): number {
  return forPlacement && !formats && !writesTyped ? countRightAnswersToKnow(quickFormat) - 1 : 0;
}

/** The goal's own format always comes first. */
export function getQuickFormatOrder(quickFormat: PlacementQuickFormat): readonly ItemFormat[] {
  return quickFormat === "trueFalse"
    ? ["trueFalse", "multipleChoice"]
    : ["multipleChoice", "trueFalse"];
}

function getQuickRank({
  format,
  quickFormat,
}: {
  format: ItemFormat;
  quickFormat: PlacementQuickFormat;
}) {
  const order = getQuickFormatOrder(quickFormat);
  const index = order.indexOf(format);

  return index === -1 ? order.length : index;
}

export function compareQuickFormat({
  a,
  b,
  quickFormat,
}: {
  a: ItemFormat;
  b: ItemFormat;
  quickFormat: PlacementQuickFormat;
}): number {
  return getQuickRank({ format: a, quickFormat }) - getQuickRank({ format: b, quickFormat });
}
