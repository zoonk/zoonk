"use client";

import {
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
import { type SerializedStep } from "../prepare-activity-data";
import { useOptionKeyboard } from "../use-option-keyboard";
import { OptionCard } from "./option-card";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";

type CallContent = Extract<InvestigationStepContent, { variant: "call" }>;

function getResultState({
  accuracy,
  hasFeedback,
  id,
  selectedId,
}: {
  accuracy: "best" | "partial" | "wrong";
  hasFeedback: boolean;
  id: string;
  selectedId: string | null;
}): "correct" | "incorrect" | undefined {
  if (!hasFeedback) {
    return undefined;
  }

  if (id === selectedId) {
    return accuracy === "best" ? "correct" : "incorrect";
  }

  if (accuracy === "best" && selectedId !== null) {
    return "correct";
  }

  return undefined;
}

/**
 * Renders the evidence quality as a Badge with visual weight
 * that matches the quality tier: strong (default), useful (secondary),
 * weak (outline).
 */
function QualityBadge({ quality }: { quality: "critical" | "useful" | "weak" }) {
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
  finding: string;
  label: string;
  quality: "critical" | "useful" | "weak";
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

  return loop.usedActionIds.flatMap((id) => {
    const action = actionContent.actions.find((a) => a.id === id);

    if (!action) {
      return [];
    }

    return [{ finding: action.finding, label: action.label, quality: action.quality }];
  });
}

function EvidenceItem({ item }: { item: GatheredEvidence }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <p className="text-sm font-medium">{item.label}</p>
        <QualityBadge quality={item.quality} />
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">{item.finding}</p>
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
              <EvidenceItem item={item} key={item.label} />
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
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();

  const { explanations } = content;
  const hasFeedback = result !== undefined;
  const evidence = useGatheredEvidence();

  const selectedId =
    selectedAnswer?.kind === "investigation" && selectedAnswer.variant === "call"
      ? selectedAnswer.selectedExplanationId
      : null;

  const hasSelection = selectedId !== null;

  const handleSelect = (index: number) => {
    if (hasFeedback) {
      return;
    }

    const explanation = explanations[index];

    if (!explanation) {
      return;
    }

    if (selectedId === explanation.id) {
      onSelectAnswer(step.id, null);
      return;
    }

    onSelectAnswer(step.id, {
      kind: "investigation",
      selectedExplanationId: explanation.id,
      variant: "call",
    });
  };

  useOptionKeyboard({
    enabled: !hasFeedback,
    onSelect: handleSelect,
    optionCount: explanations.length,
  });

  return (
    <InteractiveStepLayout>
      <EvidenceDrawer evidence={evidence} />

      <QuestionText>{t("What do you think happened?")}</QuestionText>

      <div aria-label={t("Answer options")} className="flex flex-col gap-3" role="radiogroup">
        {explanations.map((explanation, index) => (
          <OptionCard
            disabled={hasFeedback}
            index={index}
            isDimmed={hasSelection && selectedId !== explanation.id}
            isSelected={selectedId === explanation.id}
            key={explanation.id}
            onSelect={() => handleSelect(index)}
            resultState={getResultState({
              accuracy: explanation.accuracy,
              hasFeedback,
              id: explanation.id,
              selectedId,
            })}
          >
            <span className="text-base leading-6">{explanation.text}</span>
          </OptionCard>
        ))}
      </div>
    </InteractiveStepLayout>
  );
}
