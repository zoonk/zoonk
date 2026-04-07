"use client";

import { type InvestigationStepContent } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import { type SelectedAnswer } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useOptionKeyboard } from "../use-option-keyboard";
import { OptionCard } from "./option-card";
import { ContextText, QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";
import { StepVisualRenderer } from "./step-visual-renderer";

type ProblemContent = Extract<InvestigationStepContent, { variant: "problem" }>;

/**
 * Renders the problem step of an investigation activity.
 * Shows the scenario, visual, and a set of explanation options
 * for the learner to pick their initial hunch ("What's your hunch?").
 */
export function InvestigationProblemVariant({
  content,
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  content: ProblemContent;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();

  const selectedIndex =
    selectedAnswer?.kind === "investigation" && selectedAnswer.variant === "problem"
      ? selectedAnswer.selectedExplanationIndex
      : null;

  const hasSelection = selectedIndex !== null;

  const handleSelect = (index: number) => {
    if (selectedIndex === index) {
      onSelectAnswer(step.id, null);
      return;
    }

    onSelectAnswer(step.id, {
      kind: "investigation",
      selectedExplanationIndex: index,
      variant: "problem",
    });
  };

  useOptionKeyboard({
    enabled: true,
    onSelect: handleSelect,
    optionCount: content.explanations.length,
  });

  return (
    <InteractiveStepLayout>
      <SectionLabel>{t("The Case")}</SectionLabel>

      <StepVisualRenderer content={content.visual} />

      <ContextText>{content.scenario}</ContextText>

      <QuestionText>{t("What's your hunch?")}</QuestionText>

      <div aria-label={t("Answer options")} className="flex flex-col gap-3" role="radiogroup">
        {content.explanations.map((explanation, index) => (
          <OptionCard
            index={index}
            isDimmed={hasSelection && selectedIndex !== index}
            isSelected={selectedIndex === index}
            key={explanation.text}
            onSelect={() => handleSelect(index)}
          >
            <span className="text-base leading-6">{explanation.text}</span>
          </OptionCard>
        ))}
      </div>
    </InteractiveStepLayout>
  );
}
