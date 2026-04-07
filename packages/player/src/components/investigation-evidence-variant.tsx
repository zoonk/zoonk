"use client";

import { type InvestigationStepContent } from "@zoonk/core/steps/contract/content";
import { shuffle } from "@zoonk/utils/shuffle";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import { usePlayerRuntime } from "../player-context";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useOptionKeyboard } from "../use-option-keyboard";
import { InlineFeedback } from "./inline-feedback";
import { OptionCard } from "./option-card";
import { ContextText, QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";
import { StepVisualRenderer } from "./step-visual-renderer";

type EvidenceContent = Extract<InvestigationStepContent, { variant: "evidence" }>;
type InterpretationTier = "best" | "dismissive" | "overclaims";

/**
 * Shuffles the three interpretation tiers for an evidence step.
 * The shuffle is randomized each time — useMemo in the component
 * stabilizes it for the lifetime of a single evidence viewing.
 */
function shuffleInterpretationTiers(): InterpretationTier[] {
  return shuffle(["best", "dismissive", "overclaims"] as InterpretationTier[]);
}

function getResultState({
  hasFeedback,
  isCorrect,
  selectedTier,
  tier,
}: {
  hasFeedback: boolean;
  isCorrect: boolean;
  selectedTier: InterpretationTier | null;
  tier: InterpretationTier;
}): "correct" | "incorrect" | undefined {
  if (!hasFeedback) {
    return undefined;
  }

  if (tier === selectedTier) {
    return isCorrect ? "correct" : "incorrect";
  }

  if (tier === "best" && selectedTier !== "best") {
    return "correct";
  }

  return undefined;
}

/**
 * Renders the evidence step of an investigation activity.
 * Shows the finding visual, text, and three interpretation options
 * (shuffled). After checking, shows inline feedback with the
 * selected tier's feedback text.
 */
export function InvestigationEvidenceVariant({
  content,
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  content: EvidenceContent;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const { state } = usePlayerRuntime();

  const loop = state.investigationLoop;
  const hunchIndex = loop?.hunchIndex ?? 0;
  const lastActionIndex = loop?.usedActionIndices.at(-1) ?? 0;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- Re-shuffle when action changes
  const shuffledTiers = useMemo(() => shuffleInterpretationTiers(), [lastActionIndex]);

  const finding = content.findings[lastActionIndex];
  const interpretationSet = finding?.interpretations[hunchIndex];

  const selectedTier =
    selectedAnswer?.kind === "investigation" && selectedAnswer.variant === "evidence"
      ? selectedAnswer.selectedTier
      : null;

  const selectedIndex = selectedTier ? shuffledTiers.indexOf(selectedTier) : null;
  const hasSelection = selectedIndex !== null && selectedIndex !== -1;
  const hasFeedback = result !== undefined;

  const handleSelect = (index: number) => {
    if (hasFeedback) {
      return;
    }

    const tier = shuffledTiers[index];

    if (!tier) {
      return;
    }

    if (selectedTier === tier) {
      onSelectAnswer(step.id, null);
      return;
    }

    onSelectAnswer(step.id, {
      actionIndex: lastActionIndex,
      hunchIndex,
      kind: "investigation",
      selectedTier: tier,
      variant: "evidence",
    });
  };

  useOptionKeyboard({
    enabled: !hasFeedback,
    onSelect: handleSelect,
    optionCount: shuffledTiers.length,
  });

  if (!finding || !interpretationSet) {
    return null;
  }

  return (
    <InteractiveStepLayout>
      <SectionLabel>{t("Evidence")}</SectionLabel>

      <StepVisualRenderer content={finding.visual} />

      <div className="bg-muted/50 rounded-lg px-4 py-3">
        <ContextText>{finding.text}</ContextText>
      </div>

      <QuestionText>{t("What does this tell you?")}</QuestionText>

      <div aria-label={t("Answer options")} className="flex flex-col gap-3" role="radiogroup">
        {shuffledTiers.map((tier, index) => (
          <OptionCard
            disabled={hasFeedback}
            index={index}
            isDimmed={hasSelection && shuffledTiers[selectedIndex] !== tier}
            isSelected={selectedTier === tier}
            key={tier}
            onSelect={() => handleSelect(index)}
            resultState={getResultState({
              hasFeedback,
              isCorrect: result?.result.isCorrect ?? false,
              selectedTier,
              tier,
            })}
          >
            <span className="text-base leading-6">{interpretationSet[tier].text}</span>
          </OptionCard>
        ))}
      </div>

      {hasFeedback && result && <InlineFeedback result={result} />}
    </InteractiveStepLayout>
  );
}
