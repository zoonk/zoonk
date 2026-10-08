"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { Toggle } from "@zoonk/ui/components/toggle";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { useDifficultySentence } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";

type Steer = {
  active: boolean;
  label: string;
  /** Tapping an active choice goes back to the default. */
  operation: (active: boolean) => LearnerPlanOperation;
};

function useSteers(): Steer[] {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const { difficultyBias, practiceBias } = plan.steering;

  return [
    {
      active: difficultyBias === "harder",
      label: t("Too easy"),
      operation: (active) => ({ bias: active ? "standard" : "harder", kind: "setDifficultyBias" }),
    },
    {
      active: difficultyBias === "easier",
      label: t("Too hard"),
      operation: (active) => ({ bias: active ? "standard" : "easier", kind: "setDifficultyBias" }),
    },
    {
      active: practiceBias === "morePractice",
      label: t("More practice"),
      operation: (active) => ({
        bias: active ? "balanced" : "morePractice",
        kind: "setPracticeBias",
      }),
    },
    {
      active: practiceBias === "moreExplanation",
      label: t("More explanation"),
      operation: (active) => ({
        bias: active ? "balanced" : "moreExplanation",
        kind: "setPracticeBias",
      }),
    },
  ];
}

/**
 * Steering in one tap: "Too easy", "Too hard", "More practice" and "More explanation", once the
 * learner studied a lesson of the plan. Each re-plans from today; tapping an active one again
 * goes back to the default. A difficulty that isn't the default says what it does.
 */
export function PlanSteering() {
  const t = useExtracted();
  const steers = useSteers();
  const { plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const difficultySentence = useDifficultySentence();
  const { difficultyBias } = plan.steering;

  // Nothing studied yet means nothing to call too easy or too hard.
  if (plan.steering.lessonsStudied === 0) {
    return null;
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("How is it going?")}</legend>
      <div className="flex flex-wrap gap-2">
        {steers.map((steer) => (
          <Toggle
            className="aria-pressed:bg-foreground aria-pressed:text-background h-11 px-4"
            disabled={isPending}
            focusableWhenDisabled
            key={steer.label}
            onPressedChange={() => change([steer.operation(steer.active)])}
            pressed={steer.active}
            variant="outline"
          >
            {steer.label}
          </Toggle>
        ))}
      </div>

      {difficultyBias !== "standard" && (
        <p className="text-muted-foreground text-sm" role="status">
          {difficultySentence(difficultyBias)}
        </p>
      )}

      {failed && <PlanFailedMessage />}
    </fieldset>
  );
}
