"use client";

import { type InvestigationStepContent } from "@zoonk/core/steps/contract/content";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { getAvailableActions } from "../investigation";
import { usePlayerRuntime } from "../player-context";
import { type SelectedAnswer } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useOptionKeyboard } from "../use-option-keyboard";
import { OptionCard } from "./option-card";
import { QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";

type ActionContent = Extract<InvestigationStepContent, { variant: "action" }>;

/**
 * Renders the action selection step of an investigation activity.
 * Shows available investigation actions (used ones filtered out)
 * and a "Ready to make your call?" button after the first experiment.
 * The player selects an action, then clicks "Check" to advance.
 */
export function InvestigationActionVariant({
  content,
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  content: ActionContent;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const { state } = usePlayerRuntime();

  const loop = state.investigationLoop;
  const usedIndices = loop?.usedActionIndices ?? [];
  const experimentCount = loop?.experimentResults.length ?? 0;
  const availableActions = getAvailableActions(content.actions, usedIndices);
  const showMakeCallButton = experimentCount > 0;
  const questionText =
    experimentCount === 0 ? t("What do you check?") : t("What do you check next?");

  const selectedActionIndex =
    selectedAnswer?.kind === "investigation" && selectedAnswer.variant === "action"
      ? selectedAnswer.selectedActionIndex
      : null;

  const hasSelection = selectedActionIndex !== null;

  const handleSelect = (index: number) => {
    const action = availableActions[index];

    if (!action) {
      return;
    }

    if (selectedActionIndex === action.originalIndex) {
      onSelectAnswer(step.id, null);
      return;
    }

    onSelectAnswer(step.id, {
      kind: "investigation",
      readyForCall: false,
      selectedActionIndex: action.originalIndex,
      variant: "action",
    });
  };

  const handleMakeCall = () => {
    onSelectAnswer(step.id, {
      kind: "investigation",
      readyForCall: true,
      selectedActionIndex: -1,
      variant: "action",
    });
  };

  useOptionKeyboard({
    enabled: true,
    onSelect: handleSelect,
    optionCount: availableActions.length,
  });

  return (
    <InteractiveStepLayout>
      <SectionLabel>{t("Investigate")}</SectionLabel>

      <QuestionText>{questionText}</QuestionText>

      <div aria-label={t("Answer options")} className="flex flex-col gap-3" role="radiogroup">
        {availableActions.map((action, index) => (
          <OptionCard
            index={index}
            isDimmed={hasSelection && selectedActionIndex !== action.originalIndex}
            isSelected={selectedActionIndex === action.originalIndex}
            key={action.originalIndex}
            onSelect={() => handleSelect(index)}
          >
            <span className="text-base leading-6">{action.label}</span>
          </OptionCard>
        ))}
      </div>

      {showMakeCallButton && (
        <Button className="w-full" onClick={handleMakeCall} size="lg" variant="outline">
          {t("Ready to make your call?")}
        </Button>
      )}
    </InteractiveStepLayout>
  );
}
