"use client";

import { useExtracted } from "next-intl";
import { EnterButton } from "../../_components/enter-button";
import { NumericAnswerField } from "../../questions/numeric-answer-field";
import { type StudyQuestion, type StudyQuestionAnswer } from "../session-types";

/** A math problem in a block: type the number, then Check (or Enter). */
export function NumericQuestion({
  disabled,
  onAnswer,
  result,
  unit,
}: {
  disabled: boolean;
  onAnswer: (answer: StudyQuestionAnswer) => void;
  result: "correct" | "wrong" | null;
  unit: StudyQuestion["unit"];
}) {
  const t = useExtracted();

  return (
    <NumericAnswerField
      locked={disabled || result !== null}
      onSubmit={(number) => onAnswer({ number })}
      result={result}
      unit={unit}
    >
      {result === null && (
        <EnterButton disabled={disabled} type="submit">
          {t("Check")}
        </EnterButton>
      )}
    </NumericAnswerField>
  );
}
