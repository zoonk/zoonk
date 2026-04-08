"use client";

import { type InvestigationStepContent } from "@zoonk/core/steps/contract/content";
import { INVESTIGATION_EXPERIMENT_COUNT } from "@zoonk/utils/activities";
import { useExtracted } from "next-intl";
import { getAvailableActions } from "../investigation";
import { usePlayerRuntime } from "../player-context";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useOptionKeyboard } from "../use-option-keyboard";
import { OptionCard } from "./option-card";
import { ContextText, QuestionText } from "./question-text";
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
 * Returns progress-aware question text that guides the learner through
 * the investigation loop with increasingly specific language.
 *
 * First experiment is inviting ("investigate first?"), middle ones keep
 * momentum ("next?"), and the last one signals finality ("one more lead").
 */
function useQuestionText(experimentNumber: number): string {
  const t = useExtracted();

  if (experimentNumber === 0) {
    return t("What do you want to investigate first?");
  }

  if (experimentNumber >= INVESTIGATION_EXPERIMENT_COUNT - 1) {
    return t("One more lead to follow");
  }

  return t("What do you want to investigate next?");
}

/**
 * Renders the evidence feedback shown after checking an action.
 * Shows the quality indicator, finding text, and a transition message
 * after the final experiment to prepare the learner for the call step.
 */
type ActionItem = ActionContent["actions"][number];

function ActionFeedback({
  action,
  isLastExperiment,
}: {
  action: ActionItem;
  isLastExperiment: boolean;
}) {
  const t = useExtracted();
  const quality = useQualityLabel(action.quality);

  return (
    <InteractiveStepLayout>
      <p className={`text-lg font-semibold ${quality.className}`}>{quality.label}</p>

      <ContextText>{action.finding}</ContextText>

      {isLastExperiment && (
        <p className="text-muted-foreground text-sm">
          {t("Evidence complete — time to make your call.")}
        </p>
      )}
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
  const { state } = usePlayerRuntime();

  const loop = state.investigationLoop;
  const usedIds = loop?.usedActionIds ?? [];
  const experimentNumber = usedIds.length;
  const availableActions = getAvailableActions(content.actions, usedIds);
  const hasFeedback = result !== undefined;

  const questionText = useQuestionText(experimentNumber);

  const selectedActionId =
    selectedAnswer?.kind === "investigation" && selectedAnswer.variant === "action"
      ? selectedAnswer.selectedActionId
      : null;

  const hasSelection = selectedActionId !== null;

  const handleSelect = (index: number) => {
    if (hasFeedback) {
      return;
    }

    const action = availableActions[index];

    if (!action) {
      return;
    }

    if (selectedActionId === action.id) {
      onSelectAnswer(step.id, null);
      return;
    }

    onSelectAnswer(step.id, {
      kind: "investigation",
      selectedActionId: action.id,
      variant: "action",
    });
  };

  useOptionKeyboard({
    enabled: !hasFeedback,
    onSelect: handleSelect,
    optionCount: availableActions.length,
  });

  const selectedAction =
    selectedActionId === null
      ? null
      : (content.actions.find((a) => a.id === selectedActionId) ?? null);

  if (hasFeedback && selectedAction) {
    return (
      <ActionFeedback
        action={selectedAction}
        isLastExperiment={usedIds.length >= INVESTIGATION_EXPERIMENT_COUNT}
      />
    );
  }

  return (
    <InteractiveStepLayout>
      <QuestionText>{questionText}</QuestionText>

      <div aria-label={questionText} className="flex flex-col gap-3" role="radiogroup">
        {availableActions.map((action, index) => (
          <OptionCard
            index={index}
            isDimmed={hasSelection && selectedActionId !== action.id}
            isSelected={selectedActionId === action.id}
            key={action.id}
            onSelect={() => handleSelect(index)}
          >
            <span className="text-base leading-6">{action.label}</span>
          </OptionCard>
        ))}
      </div>
    </InteractiveStepLayout>
  );
}
