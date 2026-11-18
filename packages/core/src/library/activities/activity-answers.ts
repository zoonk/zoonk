import { countDecimalPlaces, isRoundedAnswer } from "@zoonk/utils/rounded-answer";
import { type ActivityAnswer } from "./activity-answer-schema";
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

export function getActivityNumericDisplay(
  content: ActivityStepContent,
): { places: number | null; value: number } | null {
  const { check } = content;

  if (check.kind !== "numeric") {
    return null;
  }

  if (Number.isInteger(check.answer)) {
    return { places: null, value: check.answer };
  }

  const exactPlaces = countDecimalPlaces(check.answer);

  for (let places = 0; places < exactPlaces; places += 1) {
    const scale = 10 ** places;
    const value = Math.round(check.answer * scale) / scale;

    if (Number.isFinite(value) && checkActivityAnswer(content, { kind: "numeric", value })) {
      return { places, value: value || 0 };
    }
  }

  return { places: exactPlaces, value: check.answer };
}

export function getActivityDecimalPlaces(content: ActivityStepContent): number | null {
  return getActivityNumericDisplay(content)?.places ?? null;
}
