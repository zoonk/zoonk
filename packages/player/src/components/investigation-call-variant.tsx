"use client";

import {
  type InvestigationStepContent,
  parseStepContent,
} from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import {
  type JourneyNarrativeData,
  type JourneyOutcome,
  buildJourneyData,
  getInvestigationStepByVariant,
} from "../investigation";
import { usePlayerRuntime } from "../player-context";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useOptionKeyboard } from "../use-option-keyboard";
import { OptionCard } from "./option-card";
import { ContextText, QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";

type CallContent = Extract<InvestigationStepContent, { variant: "call" }>;

function getResultState({
  accuracy,
  hasFeedback,
  index,
  selectedIndex,
}: {
  accuracy: "best" | "partial" | "wrong";
  hasFeedback: boolean;
  index: number;
  selectedIndex: number | null;
}): "correct" | "incorrect" | undefined {
  if (!hasFeedback) {
    return undefined;
  }

  if (index === selectedIndex) {
    return accuracy === "best" ? "correct" : "incorrect";
  }

  if (accuracy === "best" && selectedIndex !== null) {
    return "correct";
  }

  return undefined;
}

function useOutcomeText(outcome: JourneyOutcome) {
  const t = useExtracted();

  if (outcome === "changedCorrect") {
    return t(
      "You started elsewhere, but the evidence changed your mind. That's exactly how investigation works.",
    );
  }

  if (outcome === "changedIncorrect") {
    return t(
      "You changed your mind during the investigation. The evidence was tricky — that's part of the process.",
    );
  }

  if (outcome === "stayedCorrect") {
    return t("Your instinct was right — and the evidence backs it up.");
  }

  return t(
    "The evidence pointed in a different direction, but you held your ground. Sometimes the hardest part is letting go of your first idea.",
  );
}

function JourneyNarrative({ data }: { data: JourneyNarrativeData }) {
  const t = useExtracted();
  const outcomeText = useOutcomeText(data.outcome);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{t("Your journey")}</p>

      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("You started with:")}{" "}
        <span className="text-foreground font-medium">&ldquo;{data.hunchText}&rdquo;</span>
      </p>

      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("You checked:")}{" "}
        <span className="text-foreground font-medium">{data.actionLabels.join(", ")}</span>
      </p>

      <p className="text-muted-foreground text-sm leading-relaxed">{outcomeText}</p>
    </div>
  );
}

/**
 * Debrief section shown after the call step is checked.
 * Displays the full explanation reveal and a journey narrative
 * summarizing the learner's investigation path.
 */
function CallDebrief({ result }: { result: StepResult }) {
  const t = useExtracted();
  const { state } = usePlayerRuntime();
  const loop = state.investigationLoop;

  const journeyData = useMemo((): JourneyNarrativeData | null => {
    if (!loop) {
      return null;
    }

    const problemStep = getInvestigationStepByVariant(state.steps, "problem");
    const actionStep = getInvestigationStepByVariant(state.steps, "action");

    if (!problemStep || !actionStep) {
      return null;
    }

    const problemContent = parseStepContent("investigation", problemStep.content);
    const actionContent = parseStepContent("investigation", actionStep.content);

    if (problemContent.variant !== "problem" || actionContent.variant !== "action") {
      return null;
    }

    const hunchText = problemContent.explanations[loop.hunchIndex]?.text ?? "";

    const actionLabels = loop.usedActionIndices.flatMap((index) => {
      const action = actionContent.actions[index];
      return action ? [action.label] : [];
    });

    const callAnswer = result.answer;
    const callSelectedIndex =
      callAnswer?.kind === "investigation" && callAnswer.variant === "call"
        ? callAnswer.selectedExplanationIndex
        : -1;

    return buildJourneyData({
      actionLabels,
      hunchText,
      isCallCorrect: result.result.isCorrect,
      mindChanged: callSelectedIndex !== loop.hunchIndex,
    });
  }, [loop, result, state.steps]);

  return (
    <div className="flex flex-col gap-4">
      {result.result.feedback && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{t("Here's what actually happened")}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">{result.result.feedback}</p>
        </div>
      )}

      {journeyData && <JourneyNarrative data={journeyData} />}
    </div>
  );
}

/**
 * Renders the final call step of an investigation activity.
 * Shows the same explanations from the problem step with the
 * learner's original hunch marked. After checking, shows the
 * full debrief with the correct explanation and journey narrative.
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
  const { state } = usePlayerRuntime();

  const { explanations } = content;
  const loop = state.investigationLoop;
  const hunchIndex = loop?.hunchIndex ?? -1;
  const hasFeedback = result !== undefined;

  const selectedIndex =
    selectedAnswer?.kind === "investigation" && selectedAnswer.variant === "call"
      ? selectedAnswer.selectedExplanationIndex
      : null;

  const hasSelection = selectedIndex !== null;

  const handleSelect = (index: number) => {
    if (hasFeedback) {
      return;
    }

    if (selectedIndex === index) {
      onSelectAnswer(step.id, null);
      return;
    }

    onSelectAnswer(step.id, {
      kind: "investigation",
      selectedExplanationIndex: index,
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
      <SectionLabel>{t("Your Call")}</SectionLabel>

      <ContextText>{t("You've seen the evidence.")}</ContextText>

      <QuestionText>{t("What do you think happened?")}</QuestionText>

      <div aria-label={t("Answer options")} className="flex flex-col gap-3" role="radiogroup">
        {explanations.map((explanation, index) => (
          <OptionCard
            disabled={hasFeedback}
            index={index}
            isDimmed={hasSelection && selectedIndex !== index}
            isSelected={selectedIndex === index}
            key={explanation.text}
            onSelect={() => handleSelect(index)}
            resultState={getResultState({
              accuracy: explanation.accuracy,
              hasFeedback,
              index,
              selectedIndex,
            })}
          >
            <div className="flex flex-col gap-1">
              <span className="text-base leading-6">{explanation.text}</span>

              {index === hunchIndex && (
                <span className="text-muted-foreground text-xs font-medium">{t("Your hunch")}</span>
              )}
            </div>
          </OptionCard>
        ))}
      </div>

      {hasFeedback && result && <CallDebrief result={result} />}
    </InteractiveStepLayout>
  );
}
