import { type GeneratedMathProblem } from "@zoonk/ai/tasks/v2/items/schemas";
import { evaluateFormula } from "../../activities/expression/evaluate-expression";

const PLACEHOLDER = /\{(?<name>[A-Z_a-z]\w*)\}/gu;

/** Where a worked step shows the value its own expression computes. */
export const RESULT_PLACEHOLDER = "result";

const MAX_DISPLAY_DECIMALS = 4;

/** Text written without a language (item checks) reads numbers the English way. */
const DEFAULT_LANGUAGE = "en";

export type MathValues = Record<string, number>;

export function getValues(math: GeneratedMathProblem): MathValues {
  return Object.fromEntries(math.variables.map((variable) => [variable.name, variable.value]));
}

export function getPlaceholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].flatMap((match) => match.groups?.name ?? []);
}

/**
 * Shows at most four decimals, so 40 / 3 reads 13.3333 instead of 13.333333333333334, with the
 * text's own decimal separator ("2,5" in Portuguese). Digits aren't grouped, so a number reads the
 * same way the learner types it back.
 */
function formatValue({ language, value }: { language: string; value: number }): string {
  return new Intl.NumberFormat(language, {
    maximumFractionDigits: MAX_DISPLAY_DECIMALS,
    useGrouping: false,
  }).format(value);
}

/** Puts values into a question or step written with `{name}` placeholders. */
export function fillMathText({
  language = DEFAULT_LANGUAGE,
  text,
  values,
}: {
  language?: string;
  text: string;
  values: Readonly<MathValues>;
}): string {
  return text.replaceAll(PLACEHOLDER, (placeholder, name: string) => {
    const value = Object.hasOwn(values, name) ? values[name] : undefined;
    return value === undefined ? placeholder : formatValue({ language, value });
  });
}

/** A worked step with its variables and its own computed `{result}` filled in. */
export function fillMathStep({
  language,
  step,
  values,
}: {
  language?: string;
  step: GeneratedMathProblem["steps"][number];
  values: Readonly<MathValues>;
}): string {
  const result = step.expression ? evaluateFormula(step.expression, values) : null;

  return fillMathText({
    language,
    text: step.text,
    values: result?.ok ? { ...values, [RESULT_PLACEHOLDER]: result.value } : values,
  });
}
