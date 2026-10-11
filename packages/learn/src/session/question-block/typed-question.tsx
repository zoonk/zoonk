"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { EnterButton } from "../../_components/enter-button";
import { TypedAnswerField } from "../../questions/typed-answer-field";
import { type StudyQuestionAnswer } from "../session-types";

/**
 * A short typed answer (a word, a number, a term): type it, then Check (or Enter). An empty
 * answer can't be sent. Once graded, the field locks and marks the answer right or wrong.
 */
export function TypedQuestion({
  disabled,
  onAnswer,
  result,
}: {
  disabled: boolean;
  onAnswer: (answer: StudyQuestionAnswer) => void;
  result: "correct" | "wrong" | null;
}) {
  const t = useExtracted();
  const [ready, setReady] = useState(false);

  return (
    <TypedAnswerField
      locked={disabled || result !== null}
      onChange={(text) => setReady(text.length > 0)}
      onSubmit={(text) => onAnswer({ text })}
      result={result}
    >
      {result === null && (
        <EnterButton disabled={disabled || !ready} type="submit">
          {t("Check")}
        </EnterButton>
      )}
    </TypedAnswerField>
  );
}
