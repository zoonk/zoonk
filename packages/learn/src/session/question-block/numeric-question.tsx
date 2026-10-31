"use client";

import { NumericAnswerField } from "../../questions/numeric-answer-field";
import { type StudyQuestion } from "../session-types";

/** The host gets the number once the box takes it, null before. */
export function NumericQuestion({
  disabled,
  entry,
  onChange,
  onSubmit,
  result,
  unit,
}: {
  disabled: boolean;
  entry: StudyQuestion["entry"];
  onChange: (answer: { number: number } | null) => void;
  onSubmit: (answer: { number: number }) => void;
  result: "correct" | "wrong" | null;
  unit: StudyQuestion["unit"];
}) {
  return (
    <NumericAnswerField
      entry={entry}
      locked={disabled || result !== null}
      onChange={(number) => onChange(number === null ? null : { number })}
      onSubmit={(number) => onSubmit({ number })}
      result={result}
      unit={unit}
    />
  );
}
