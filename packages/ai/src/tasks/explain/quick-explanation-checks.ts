import { normalizeString } from "@zoonk/utils/string";
import { type QuickExplanation } from "./quick-explanation";

export const QUICK_EXPLANATION_MIN_SCREENS = 4;
export const QUICK_EXPLANATION_MAX_SCREENS = 6;

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values.map((value) => normalizeString(value))).size !== values.length;
}

/** One line per problem: an empty list means the explanation passes. */
export function checkQuickExplanation(explanation: QuickExplanation): string[] {
  const { check, description, recap, screens } = explanation;
  const correctOptions = check.options.filter((option) => option.isCorrect).length;

  return [
    !description.trim() && "The description is empty.",
    (screens.length < QUICK_EXPLANATION_MIN_SCREENS ||
      screens.length > QUICK_EXPLANATION_MAX_SCREENS) &&
      `Has ${screens.length} screens instead of ${QUICK_EXPLANATION_MIN_SCREENS} to ${QUICK_EXPLANATION_MAX_SCREENS}.`,
    screens.some((screen) => !screen.title.trim() || !screen.text.trim()) &&
      "A screen has an empty title or text.",
    screens.some(
      (screen) => screen.image && (!screen.image.prompt.trim() || !screen.image.alt.trim()),
    ) && "A picture has an empty prompt or alt text.",
    hasDuplicates(screens.map((screen) => screen.title)) && "Two screens share a title.",
    correctOptions !== 1 && `The check has ${correctOptions} correct options instead of 1.`,
    hasDuplicates(check.options.map((option) => option.text)) && "Two check options are the same.",
    check.options.some((option) => !option.feedback.trim()) && "A check option has no feedback.",
    hasDuplicates(recap) && "Two recap bullets are the same.",
  ].filter((problem) => typeof problem === "string");
}
