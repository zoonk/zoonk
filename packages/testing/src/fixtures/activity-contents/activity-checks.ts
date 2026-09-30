/** Checks and data notes shared by the activity fixtures, in the shape core's schemas expect. */

const NUMERIC_TOLERANCE = 0.01;

export const interactionCheck = { explanation: "Here is why.", kind: "interaction" } as const;

export const citedData = {
  source: { publisher: "NOAA", title: "Mauna Loa CO2 record", year: 2024 },
};

export const exampleData = { isExample: true } as const;

/**
 * A choice check from `[text, isCorrect, value?]` tuples. Give every option a value when the
 * template computes a number the options stand for.
 */
export function choiceCheck(question: string, options: [string, boolean, number?][]) {
  return {
    kind: "choice" as const,
    options: options.map(([text, isCorrect, value], index) => ({
      id: `o${index}`,
      isCorrect,
      reason: `Because of ${text}.`,
      text,
      ...(value === undefined ? {} : { value }),
    })),
    question,
  };
}

/** A numeric check with a small absolute tolerance; `extra` adds inputs, output or a unit. */
export function numericCheck<TExtra extends object>(answer: number, extra?: TExtra) {
  return {
    answer,
    explanation: "Worked out by code.",
    kind: "numeric" as const,
    question: "What is the value?",
    tolerance: { kind: "absolute" as const, value: NUMERIC_TOLERANCE },
    ...extra,
  };
}
