import { formatLocalizedNumber, parseLocalizedNumber } from "@zoonk/utils/localized-number";
import { countDecimalPlaces, isRoundedAnswer } from "@zoonk/utils/rounded-answer";
import { type ActivityAnswer } from "./activity-answer-schema";
import { type ActivityTolerance } from "./activity-schemas";
import { type ActivityStepContent, getActivityTemplate } from "./activity-templates";
import { matchesExpectedAnswer } from "./templates/_utils/grade-interaction";
import { withinTolerance } from "./templates/_utils/pattern-checks";

/** Uses the same computed answer as publishing; numeric answers also accept rounding to the typed precision. */
export function checkActivityAnswer(content: ActivityStepContent, answer: ActivityAnswer): boolean {
  const { check } = content;

  if (check.kind === "choice") {
    return (
      answer.kind === "choice" &&
      check.options.some((option) => option.id === answer.optionId && option.isCorrect)
    );
  }

  const template = getActivityTemplate(content.template);

  if (check.kind === "numeric") {
    const tolerances = [check.tolerance, template?.minTolerance].filter(
      (item) => item !== undefined,
    );

    return (
      answer.kind === "numeric" &&
      (tolerances.some((tolerance) =>
        withinTolerance({ expected: check.answer, tolerance, value: answer.value }),
      ) ||
        isRoundedAnswer({ expected: check.answer, value: answer.value }))
    );
  }

  const expected = template?.computeExpected(content.fields) ?? null;

  return expected !== null && matchesExpectedAnswer(expected, answer);
}

/** A `numeric` answer as every app writes it; `places` is null for a whole-number answer, which needs no rounding. */
export type ActivityRoundedAnswer = { places: number | null; value: number };

/** Rounds half away from zero, as the apps' number formatting does. */
function roundToPlaces(value: number, places: number): number {
  const locale = "en";

  const text = formatLocalizedNumber({
    grouping: false,
    locale,
    maximumFractionDigits: places,
    value,
  });

  return parseLocalizedNumber({ locale, text }) ?? value;
}

/** The coarsest rounding the check accepts: the places its hint names, used by every number written for the answer. */
export function getActivityRoundedAnswer(
  content: ActivityStepContent,
): ActivityRoundedAnswer | null {
  const { check } = content;

  if (check.kind !== "numeric") {
    return null;
  }

  if (Number.isInteger(check.answer)) {
    return { places: null, value: check.answer };
  }

  const exactPlaces = countDecimalPlaces(check.answer);

  for (let places = 0; places < exactPlaces; places += 1) {
    const value = roundToPlaces(check.answer, places);

    if (checkActivityAnswer(content, { kind: "numeric", value })) {
      return { places, value };
    }
  }

  return { places: exactPlaces, value: check.answer };
}

/** What an app needs to grade and write a numeric answer as core does. */
export function getActivityAnswerRules(content: ActivityStepContent): {
  minTolerance: ActivityTolerance | null;
  roundedAnswer: ActivityRoundedAnswer | null;
} {
  return {
    minTolerance: getActivityTemplate(content.template)?.minTolerance ?? null,
    roundedAnswer: getActivityRoundedAnswer(content),
  };
}

/** The hint's places for a checked learner's number, or null when there's no hint or the rounded number would grade differently from what was typed. */
export function getCheckedAnswerPlaces({
  content,
  isCorrect,
  value,
}: {
  content: ActivityStepContent;
  isCorrect: boolean;
  value: number;
}): number | null {
  const places = getActivityRoundedAnswer(content)?.places ?? null;

  if (places === null) {
    return null;
  }

  const shown = roundToPlaces(value, places);

  return checkActivityAnswer(content, { kind: "numeric", value: shown }) === isCorrect
    ? places
    : null;
}
