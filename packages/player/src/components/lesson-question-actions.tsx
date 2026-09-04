"use client";

import { Button } from "@zoonk/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { BookOpenTextIcon, MessageSquareTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  getAnswerQuestionContext,
  getStepQuestionContext,
} from "../_utils/player-question-context";
import { usePlayerQuestionSupport, usePlayerRuntime } from "../player-context";
import { getCurrentResult, getCurrentStep, getSelectedAnswer } from "../player-selectors";

function QuestionActionButton({
  children,
  className,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        className={className}
        disabled={disabled}
        onClick={onClick}
        render={<Button disabled={disabled} size="icon-lg" type="button" variant="outline" />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Keeps one quiet help action beside the primary lesson control. Before a
 * submission it opens a step-scoped question; after feedback it asks for an
 * explanation of the checked answer without making the learner write a prompt.
 */
export function ContextualQuestionAction({ className }: { className?: string } = {}) {
  const t = useExtracted();
  const questionSupport = usePlayerQuestionSupport();
  const { state } = usePlayerRuntime();
  const result = getCurrentResult(state);
  const selectedAnswer = getSelectedAnswer(state);
  const currentStep = getCurrentStep(state);

  if (!questionSupport || !currentStep) {
    return null;
  }

  const answerContext = getAnswerQuestionContext({
    phase: state.phase,
    result,
    selectedAnswer,
    step: currentStep,
    stepIndex: state.currentStepIndex,
  });

  if (answerContext && result) {
    if (!questionSupport.canExplainAnswer) {
      return (
        <QuestionActionButton
          className={className}
          disabled={questionSupport.interactionState === "paused"}
          label={t("Open questions")}
          onClick={() => questionSupport.onAskQuestion(answerContext)}
        >
          <MessageSquareTextIcon aria-hidden="true" />
        </QuestionActionButton>
      );
    }

    const question = result.result.isCorrect
      ? t("Why is this answer correct?")
      : t("Why was my answer wrong? Explain the correct answer.");

    return (
      <QuestionActionButton
        className={className}
        disabled={questionSupport.interactionState === "paused"}
        label={t("Explain answer")}
        onClick={() => questionSupport.onExplainAnswer({ context: answerContext, question })}
      >
        <BookOpenTextIcon aria-hidden="true" />
      </QuestionActionButton>
    );
  }

  const questionContext = getStepQuestionContext({
    phase: state.phase,
    step: currentStep,
    stepIndex: state.currentStepIndex,
  });

  if (!questionContext) {
    return null;
  }

  return (
    <QuestionActionButton
      className={className}
      disabled={questionSupport.interactionState === "paused"}
      label={t("Ask about this lesson")}
      onClick={() => questionSupport.onAskQuestion(questionContext)}
    >
      <MessageSquareTextIcon aria-hidden="true" />
    </QuestionActionButton>
  );
}

function CompletionQuestionAction() {
  const t = useExtracted();
  const questionSupport = usePlayerQuestionSupport();

  if (!questionSupport) {
    return null;
  }

  return (
    <QuestionActionButton
      disabled={questionSupport.interactionState === "paused"}
      label={t("Ask about this lesson")}
      onClick={() => questionSupport.onAskQuestion({ kind: "lesson" })}
    >
      <MessageSquareTextIcon aria-hidden="true" />
    </QuestionActionButton>
  );
}

/** Places lesson-scoped help beside the completion screen's primary destination. */
export function CompletionPrimaryActionGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      <CompletionQuestionAction />
    </div>
  );
}
