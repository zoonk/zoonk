import { type ItemFormat } from "@zoonk/db";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getExamChoiceFormat } from "../../library/exams/exam-choice-format";

/** How placement asks a skill the first time: one right option, or an assertion judged right or wrong. */
export type PlacementQuickFormat = "multipleChoice" | "trueFalse";

/**
 * A goal's quick placement format: its exam's own when the exam judges assertions right or wrong
 * (Cebraspe's Certo ou Errado), so placement feels like the exam's drills; multiple choice
 * otherwise, and before the goal's blueprint is known. The typed confirmation is the same for all.
 */
export function getPlacementQuickFormat(
  structure: Pick<ExamStructure, "formats"> | null,
): PlacementQuickFormat {
  return getExamChoiceFormat(structure)?.kind ?? "multipleChoice";
}

/** The quick formats in the order a goal asks them: its own first, so the other never wins. */
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

/** Orders a skill's quick questions, such as a session's placement ones: the goal's format first. */
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
