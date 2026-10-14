"use client";

import { NumericAnswerField } from "../../questions/numeric-answer-field";
import { type StudyQuestion } from "../session-types";

/**
 * A math problem in a block: type the number. The host gets it once it reads as a number the box
 * takes (null before) and its Check sends it; Enter in the field sends it too, or says how to
 * write one.
 */
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
