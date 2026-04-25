"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import {
  type InvestigationActionQuality,
  type InvestigationCallAccuracy,
  type InvestigationStepContent,
  parseStepContent,
} from "@zoonk/core/steps/contract/content";
import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { useExtracted } from "next-intl";
import { getInvestigationStepByVariant } from "../investigation";
import { usePlayerRuntime } from "../player-context";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import {
  PlayerChoiceScene,
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
  PlayerChoiceScenePrompt,
  PlayerChoiceSceneQuestion,
} from "./player-choice-scene";

type CallContent = Extract<InvestigationStepContent, { variant: "call" }>;

function getResultState({
  accuracy,
  hasFeedback,
  id,
  selectedId,
}: {
  accuracy: InvestigationCallAccuracy;
  hasFeedback: boolean;
  id: string;
  selectedId: string | null;
}): "correct" | "incorrect" | null {
  if (!hasFeedback) {
    return null;
  }

  if (id === selectedId) {
    return accuracy === "best" ? "correct" : "incorrect";
  }

  if (accuracy === "best" && selectedId !== null) {
    return "correct";
  }

  return null;
}

/**
 * Renders the evidence quality as a Badge with visual weight
 * that matches the quality tier: strong (default), useful (secondary),
 * weak (outline).
 */
function QualityBadge({ quality }: { quality: InvestigationActionQuality }) {
  const t = useExtracted();

  if (quality === "critical") {
    return <Badge>{t("Strong lead")}</Badge>;
  }

  if (quality === "useful") {
    return <Badge variant="secondary">{t("Useful clue")}</Badge>;
  }

  return <Badge variant="outline">{t("Weak signal")}</Badge>;
}

type GatheredEvidence = {
  feedback: string;
  quality: InvestigationActionQuality;
  text: string;
};

/**
 * Builds the list of evidence the learner gathered during investigation.
 * Reads from the action step content using the tracked action indices.
 */
function useGatheredEvidence(): GatheredEvidence[] {
  const { state } = usePlayerRuntime();
  const loop = state.investigationLoop;

  if (!loop) {
    return [];
  }

  const actionStep = getInvestigationStepByVariant(state.steps, "action");

  if (!actionStep) {
    return [];
  }

  const actionContent = parseStepContent("investigation", actionStep.content);

  if (actionContent.variant !== "action") {
    return [];
  }

  return loop.usedOptionIds.flatMap((id) => {
    const action = actionContent.options.find((a) => a.id === id);

    if (!action) {
      return [];
    }

    return [{ feedback: action.feedback, quality: action.quality, text: action.text }];
  });
}

function EvidenceItem({ item }: { item: GatheredEvidence }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <p className="text-sm font-medium">{item.text}</p>
        <QualityBadge quality={item.quality} />
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">{item.feedback}</p>
    </div>
  );
}

/**
 * Bottom-sheet drawer showing the evidence gathered during investigation.
 * Players can swipe to dismiss or tap the backdrop to close.
 */
function EvidenceDrawer({ evidence }: { evidence: GatheredEvidence[] }) {
  const t = useExtracted();

  if (evidence.length === 0) {
    return null;
  }

  return (
    <Drawer>
      <DrawerTrigger
        render={
          <Button className="self-start" variant="outline" size="sm">
            {t("Review evidence")}
          </Button>
        }
      />

      <DrawerPopup>
        <DrawerHeader>
          <DrawerTitle>{t("Evidence")}</DrawerTitle>
        </DrawerHeader>

        <DrawerContent>
          <div className="flex flex-col gap-5">
            {evidence.map((item) => (
              <EvidenceItem item={item} key={item.text} />
            ))}
          </div>
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}

/**
 * Renders the final call step of an investigation activity.
 * Shows a "Review evidence" button that opens a bottom-sheet drawer,
 * then the explanation options for the learner to make their call.
 * After checking, feedback is shown on a dedicated feedback screen.
 */
export function InvestigationCallVariant({
  content,
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  content: CallContent;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const t = useExtracted();

  const { options } = content;
  const hasFeedback = result !== undefined;
  const evidence = useGatheredEvidence();

  const selectedId =
    selectedAnswer?.kind === "investigation" && selectedAnswer.variant === "call"
      ? selectedAnswer.selectedOptionId
      : null;

  const hasSelection = selectedId !== null;

  const handleSelect = (index: number) => {
    if (hasFeedback) {
      return;
    }

    const explanation = options[index];

    if (!explanation) {
      return;
    }

    if (selectedId === explanation.id) {
      onSelectAnswer(step.id, null);
      return;
    }

    onSelectAnswer(step.id, {
      kind: "investigation",
      selectedOptionId: explanation.id,
      variant: "call",
    });
  };

  return (
    <PlayerChoiceScene>
      <EvidenceDrawer evidence={evidence} />

      <PlayerChoiceScenePrompt>
        <PlayerChoiceSceneQuestion>{t("What do you think happened?")}</PlayerChoiceSceneQuestion>
      </PlayerChoiceScenePrompt>

      <PlayerChoiceSceneOptions
        keyboardEnabled={!hasFeedback}
        onSelect={handleSelect}
        options={options.map((explanation) => ({
          content: <PlayerChoiceSceneOptionText>{explanation.text}</PlayerChoiceSceneOptionText>,
          disabled: hasFeedback,
          isDimmed: hasSelection && selectedId !== explanation.id,
          isSelected: selectedId === explanation.id,
          key: explanation.id,
          resultState: getResultState({
            accuracy: explanation.accuracy,
            hasFeedback,
            id: explanation.id,
            selectedId,
          }),
        }))}
      />
    </PlayerChoiceScene>
  );
}
