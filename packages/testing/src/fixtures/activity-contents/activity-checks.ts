const NUMERIC_TOLERANCE = 0.01;

export const interactionCheck = { explanation: "Here is why.", kind: "interaction" } as const;

export const citedData = {
  source: { publisher: "NOAA", title: "Mauna Loa CO2 record", year: 2024 },
};

export const exampleData = { isExample: true } as const;

/** Give every option a value when the template computes a number the options stand for. */
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
