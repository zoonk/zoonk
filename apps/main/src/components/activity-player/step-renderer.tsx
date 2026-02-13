"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { type SelectedAnswer } from "./player-reducer";
import {
  InteractiveStepLayout,
  StaticStepLayout,
  StaticStepText,
  StaticStepVisual,
} from "./step-layouts";
import { getMockAnswer, getStepSummary } from "./step-renderer-utils";

function getStaticContent(step: SerializedStep): { heading: string; body: string } {
  const content = parseStepContent("static", step.content);

  if (content.variant === "grammarExample") {
    return { body: content.translation, heading: content.sentence };
  }

  if (content.variant === "grammarRule") {
    return { body: content.ruleSummary, heading: content.ruleName };
  }

  return { body: content.text, heading: content.title };
}

function PlaceholderStaticStep({ step }: { step: SerializedStep }) {
  const { body, heading } = getStaticContent(step);

  return (
    <>
      <StaticStepVisual />

      <StaticStepText>
        <h2 className="text-xl font-semibold">{heading}</h2>
        <p className="text-muted-foreground">{body}</p>
      </StaticStepText>
    </>
  );
}

function PlaceholderInteractiveStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const summary = getStepSummary(step);
  const mockAnswer = getMockAnswer(step);
  const hasAnswer = selectedAnswer !== undefined;

  const handleClick = () => {
    if (mockAnswer) {
      onSelectAnswer(step.id, mockAnswer);
    }
  };

  return (
    <InteractiveStepLayout>
      <p className="text-muted-foreground text-center">{summary}</p>

      <Button disabled={hasAnswer || !mockAnswer} onClick={handleClick} variant="outline">
        {hasAnswer ? t("Answer selected") : t("Select answer")}
      </Button>
    </InteractiveStepLayout>
  );
}

export function StepRenderer({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  if (step.kind === "static") {
    return (
      <StaticStepLayout>
        <PlaceholderStaticStep step={step} />
      </StaticStepLayout>
    );
  }

  return (
    <PlaceholderInteractiveStep
      onSelectAnswer={onSelectAnswer}
      selectedAnswer={selectedAnswer}
      step={step}
    />
  );
}
