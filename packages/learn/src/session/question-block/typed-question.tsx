"use client";

import { TypedAnswerField } from "../../questions/typed-answer-field";

/** The host gets it as it's typed, null while it's empty. */
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
