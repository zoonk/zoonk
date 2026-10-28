import { type GeneratedMathProblem } from "@zoonk/ai/tasks/v2/items/schemas";
import { evaluateFormula } from "../../activities/expression/evaluate-expression";

const PLACEHOLDER = /\{(?<name>[A-Z_a-z]\w*)\}/gu;

export const RESULT_PLACEHOLDER = "result";

const MAX_DISPLAY_DECIMALS = 4;

const DEFAULT_LANGUAGE = "en";

export type MathValues = Record<string, number>;

export function getValues(math: GeneratedMathProblem): MathValues {
  return Object.fromEntries(math.variables.map((variable) => [variable.name, variable.value]));
}

export function getPlaceholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].flatMap((match) => match.groups?.name ?? []);
}

function formatValue({ language, value }: { language: string; value: number }): string {
  return new Intl.NumberFormat(language, {
    maximumFractionDigits: MAX_DISPLAY_DECIMALS,
    useGrouping: "min2",
  }).format(value);
}

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
