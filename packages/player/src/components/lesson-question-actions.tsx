"use client";

import { Button } from "@zoonk/ui/components/button";
import { BookOpenTextIcon, MessageSquareTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  getAnswerQuestionContext,
  getHeaderQuestionContext,
} from "../_utils/player-question-context";
import { usePlayerQuestionSupport, usePlayerRuntime } from "../player-context";
import { getCurrentResult, getCurrentStep, getSelectedAnswer } from "../player-selectors";

export function HeaderQuestionAction() {
  const t = useExtracted();
  const questionSupport = usePlayerQuestionSupport();
  const { state } = usePlayerRuntime();
  const currentStep = getCurrentStep(state);

  if (!questionSupport || !currentStep) {
    return null;
  }

  const questionContext = getHeaderQuestionContext({
    phase: state.phase,
    step: currentStep,
    stepIndex: state.currentStepIndex,
  });

  if (!questionContext) {
    return null;
  }

  return (
    <Button
      aria-label={t("Ask a question about this step")}
      disabled={questionSupport.interactionState === "paused"}
      onClick={() => questionSupport.onAskQuestion(questionContext)}
      size="adaptive"
      type="button"
      variant="outline"
    >
      <MessageSquareTextIcon aria-hidden="true" />
      <span className="hidden lg:inline">{t("Ask")}</span>
    </Button>
  );
}

export function AnswerExplanationAction() {
  const t = useExtracted();
  const questionSupport = usePlayerQuestionSupport();
  const { state } = usePlayerRuntime();
  const result = getCurrentResult(state);
  const selectedAnswer = getSelectedAnswer(state);
  const step = getCurrentStep(state);

  if (!questionSupport || !step) {
    return null;
  }

  const context = getAnswerQuestionContext({
    phase: state.phase,
    result,
    selectedAnswer,
    step,
    stepIndex: state.currentStepIndex,
  });

  if (!context || !result) {
    return null;
  }

  const question = result.result.isCorrect
    ? t("Explain why this answer is correct.")
    : t("Explain why my answer was wrong and why the correct answer is correct.");

  return (
    <Button
      aria-label={t("Explain answer")}
      disabled={questionSupport.interactionState === "paused"}
      onClick={() => questionSupport.onExplainAnswer({ context, question })}
      size="lg"
      type="button"
      variant="outline"
    >
      <BookOpenTextIcon aria-hidden="true" />
      <span className="hidden sm:inline">{t("Explain answer")}</span>
    </Button>
  );
}

export function CompletionQuestionAction() {
  const t = useExtracted();
  const questionSupport = usePlayerQuestionSupport();

  if (!questionSupport) {
    return null;
  }

  return (
    <Button
      className="w-full"
      disabled={questionSupport.interactionState === "paused"}
      onClick={() => questionSupport.onAskQuestion({ kind: "lesson" })}
      type="button"
      variant="outline"
    >
      <MessageSquareTextIcon aria-hidden="true" />
      {t("Ask about this lesson")}
    </Button>
  );
}
