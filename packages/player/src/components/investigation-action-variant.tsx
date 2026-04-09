"use client";

import {
  type InvestigationActionQuality,
  type InvestigationStepContent,
} from "@zoonk/core/steps/contract/content";
import { INVESTIGATION_EXPERIMENT_COUNT } from "@zoonk/utils/activities";
import { useExtracted } from "next-intl";
import { getAvailableActions } from "../investigation";
import { usePlayerRuntime } from "../player-context";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import {
  PlayerChoiceScene,
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
  PlayerChoiceScenePrompt,
  PlayerChoiceSceneQuestion,
} from "./player-choice-scene";
import { PlayerReadScene, PlayerReadSceneBody } from "./player-read-scene";
import { PlayerSupportingText } from "./player-supporting-text";

type ActionContent = Extract<InvestigationStepContent, { variant: "action" }>;

/**
 * Returns a user-friendly quality label for the action's evidence.
 * Shown as a quality indicator in the evidence feedback after checking.
 */
function useQualityLabel(quality: InvestigationActionQuality): {
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
 * First experiment is inviting ("investigate first?"), the last one
 * signals finality ("one more lead").
 */
function useQuestionText(experimentNumber: number): string {
  const t = useExtracted();

  if (experimentNumber === 0) {
    return t("What do you want to investigate first?");
  }

  return t("One more lead to follow");
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
    <PlayerReadScene>
      <p className={`text-lg font-semibold ${quality.className}`}>{quality.label}</p>

      <PlayerReadSceneBody>{action.finding}</PlayerReadSceneBody>

      {isLastExperiment && (
        <PlayerSupportingText>
          {t("Evidence complete — time to make your call.")}
        </PlayerSupportingText>
      )}
    </PlayerReadScene>
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
    <PlayerChoiceScene>
      <PlayerChoiceScenePrompt>
        <PlayerChoiceSceneQuestion>{questionText}</PlayerChoiceSceneQuestion>
      </PlayerChoiceScenePrompt>

      <PlayerChoiceSceneOptions
        ariaLabel={questionText}
        keyboardEnabled={!hasFeedback}
        onSelect={handleSelect}
        options={availableActions.map((action) => ({
          content: <PlayerChoiceSceneOptionText>{action.label}</PlayerChoiceSceneOptionText>,
          isDimmed: hasSelection && selectedActionId !== action.id,
          isSelected: selectedActionId === action.id,
          key: action.id,
        }))}
      />
    </PlayerChoiceScene>
  );
}
