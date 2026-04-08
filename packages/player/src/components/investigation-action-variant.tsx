"use client";

import { type InvestigationStepContent } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import { getAvailableActions } from "../investigation";
import { usePlayerRuntime } from "../player-context";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useOptionKeyboard } from "../use-option-keyboard";
import { OptionCard } from "./option-card";
import { ContextText, QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";

type ActionContent = Extract<InvestigationStepContent, { variant: "action" }>;

/**
 * Returns a user-friendly quality label for the action's evidence.
 * Shown as a quality indicator in the evidence feedback after checking.
 */
function useQualityLabel(quality: "critical" | "useful" | "weak"): {
  className: string;
  label: string;
} {
  const t = useExtracted();

  if (quality === "critical") {
    return { className: "text-success", label: t("Strong lead") };
  }

  if (quality === "useful") {
    return { className: "text-foreground", label: t("Useful clue") };
  }

  return { className: "text-muted-foreground", label: t("Weak signal") };
}

/**
 * Renders the evidence feedback shown after checking an action.
 * Shows the quality indicator and finding text.
 */
type ActionItem = ActionContent["actions"][number];

function ActionFeedback({ action }: { action: ActionItem }) {
  const t = useExtracted();
  const quality = useQualityLabel(action.quality);

  return (
    <InteractiveStepLayout>
      <SectionLabel>{t("Evidence")}</SectionLabel>

      <p className={`text-sm font-medium ${quality.className}`}>{quality.label}</p>

      <div className="bg-muted/50 rounded-lg px-4 py-3">
        <ContextText>{action.finding}</ContextText>
      </div>
    </InteractiveStepLayout>
  );
}

/**
 * Renders the action selection step of an investigation activity.
 *
 * Before checking: shows available actions (used ones filtered out).
 * After checking: shows evidence feedback — quality indicator
 * and finding text for the selected action.
 */
export function InvestigationActionVariant({
  content,
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  content: ActionContent;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const { state } = usePlayerRuntime();

  const loop = state.investigationLoop;
  const usedIndices = loop?.usedActionIndices ?? [];
  const experimentNumber = usedIndices.length;
  const availableActions = getAvailableActions(content.actions, usedIndices);
  const hasFeedback = result !== undefined;

  const questionText =
    experimentNumber === 0 ? t("What do you check?") : t("What do you check next?");

  const selectedActionIndex =
    selectedAnswer?.kind === "investigation" && selectedAnswer.variant === "action"
      ? selectedAnswer.selectedActionIndex
      : null;

  const hasSelection = selectedActionIndex !== null;

  const handleSelect = (index: number) => {
    if (hasFeedback) {
      return;
    }

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
      selectedActionIndex: action.originalIndex,
      variant: "action",
    });
  };

  useOptionKeyboard({
    enabled: !hasFeedback,
    onSelect: handleSelect,
    optionCount: availableActions.length,
  });

  const selectedAction = selectedActionIndex === null ? null : content.actions[selectedActionIndex];

  if (hasFeedback && selectedAction) {
    return <ActionFeedback action={selectedAction} />;
  }

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
    </InteractiveStepLayout>
  );
}
