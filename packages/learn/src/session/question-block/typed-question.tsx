"use client";

import { TypedAnswerField } from "../../questions/typed-answer-field";

/**
 * A short typed answer (a word, a number, a term). The host gets it as it's typed (null while
 * it's empty) and its Check sends it; Enter in the field sends it too. Once graded, the field
 * locks and marks the answer right or wrong.
 */
export function TypedQuestion({
  disabled,
  onChange,
  onSubmit,
  result,
}: {
  disabled: boolean;
  onChange: (answer: { text: string } | null) => void;
  onSubmit: (answer: { text: string }) => void;
  result: "correct" | "wrong" | null;
}) {
  return (
    <TypedAnswerField
      locked={disabled || result !== null}
      onChange={(text) => onChange(text ? { text } : null)}
      onSubmit={(text) => onSubmit({ text })}
      result={result}
    />
  );
}
