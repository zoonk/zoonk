"use client";

import {
  type InvestigationStepContent,
  parseStepContent,
} from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import { getInvestigationStepByVariant } from "../investigation";
import { usePlayerRuntime } from "../player-context";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useOptionKeyboard } from "../use-option-keyboard";
import { OptionCard } from "./option-card";
import { QuestionText } from "./question-text";
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

/**
 * Renders a translated quality label for an action.
 * Extracted as a component so it can call useExtracted internally
 * instead of receiving `t` as a function argument.
 */
function QualityText({ quality }: { quality: "critical" | "useful" | "weak" }) {
  const t = useExtracted();

  if (quality === "critical") {
    return <>{t("strong lead")}</>;
  }

  if (quality === "useful") {
    return <>{t("useful clue")}</>;
  }

  return <>{t("weak signal")}</>;
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

  return loop.usedActionIndices.flatMap((index) => {
    const action = actionContent.actions[index];

    if (!action) {
      return [];
    }

    return [{ finding: action.finding, label: action.label, quality: action.quality }];
  });
}

/**
 * Compact evidence summary shown before the learner makes their call.
 * Lists each gathered finding with its action label and quality indicator.
 */
function EvidenceSummary({ evidence }: { evidence: GatheredEvidence[] }) {
  const t = useExtracted();

  if (evidence.length === 0) {
    return null;
  }

  return (
    <div className="bg-muted/30 flex flex-col gap-3 rounded-lg px-4 py-3">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {t("Your evidence")}
      </p>

      {evidence.map((item) => (
        <div className="flex flex-col gap-0.5" key={item.label}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="text-muted-foreground text-xs font-medium">
              <QualityText quality={item.quality} />
            </p>
          </div>

          <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            {item.finding}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Debrief section shown after the call step is checked.
 * Displays the full explanation reveal and a summary of which actions
 * the learner chose during investigation.
 */
function CallDebrief({ evidence, result }: { evidence: GatheredEvidence[]; result: StepResult }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-4">
      {result.result.feedback && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{t("Here's what actually happened")}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">{result.result.feedback}</p>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{t("You checked")}</p>

          <ul className="flex flex-col gap-1">
            {evidence.map((item) => (
              <li className="text-muted-foreground text-sm" key={item.label}>
                {item.label}{" "}
                <span className="text-muted-foreground/70">
                  (<QualityText quality={item.quality} />)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Renders the final call step of an investigation activity.
 * Shows gathered evidence summary, then the explanation options.
 * After checking, shows the full debrief with the correct explanation
 * and a summary of the learner's investigation journey.
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

      <EvidenceSummary evidence={evidence} />

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
            <span className="text-base leading-6">{explanation.text}</span>
          </OptionCard>
        ))}
      </div>

      {hasFeedback && result && <CallDebrief evidence={evidence} result={result} />}
    </InteractiveStepLayout>
  );
}
