import { type Goal, type ItemFormat } from "@zoonk/db";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getExamChoiceFormat } from "../../library/exams/exam-choice-format";
import { countRightAnswersToKnow } from "./placement-beliefs";

/** How placement asks a skill the first time: one right option, or an assertion judged right or wrong. */
export type PlacementQuickFormat = "multipleChoice" | "trueFalse";

/**
 * A goal's quick placement format: its exam's own when the exam judges assertions right or wrong
 * (Cebraspe's right-or-wrong statements), so placement feels like the exam's drills; multiple choice
 * otherwise, and before the goal's blueprint is known.
 */
export function getPlacementQuickFormat(
  structure: Pick<ExamStructure, "formats"> | null,
): PlacementQuickFormat {
  return getExamChoiceFormat(structure)?.kind ?? "multipleChoice";
}

/**
 * Whether placement confirms a right quick answer with a typed question: only a language goal's,
 * since writing in the language is what it learns. Placement measures what the learner knows, and
 * typing at their first steps is friction, so every other goal confirms with more quick questions;
 * its exam's written formats are practiced elsewhere.
 */
export function confirmsInWriting(goal: Pick<Goal, "targetLanguage">): boolean {
  return goal.targetLanguage !== null;
}

/**
 * The quick questions placement's own run writes per skill beyond the first, so a right answer is
 * confirmed by another as surely as a typed answer did (`countRightAnswersToKnow`): one more
 * multiple-choice pick, two more statements judged right or wrong. None where placement confirms
 * in writing (`confirmsInWriting`) or for a run that narrows `formats` (a test-out, a mock), nor
 * for other runs (practice).
 */
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
