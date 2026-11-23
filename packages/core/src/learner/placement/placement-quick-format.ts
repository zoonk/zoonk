import { type ItemFormat } from "@zoonk/db";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getExamChoiceFormat } from "../../library/exams/exam-choice-format";
import { countRightAnswersToKnow } from "./placement-beliefs";

export type PlacementQuickFormat = "multipleChoice" | "trueFalse";

export function getPlacementQuickFormat(
  structure: Pick<ExamStructure, "formats"> | null,
): PlacementQuickFormat {
  return getExamChoiceFormat(structure)?.kind ?? "multipleChoice";
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
