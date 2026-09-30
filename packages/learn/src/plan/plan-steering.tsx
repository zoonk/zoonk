"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { Toggle } from "@zoonk/ui/components/toggle";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { ContentThumbsRow } from "../feedback/content-thumbs";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
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
 * Steering in one tap: "Too easy", "Too hard", "More practice" and "More explanation". Each
 * re-plans from today and shows up in the changes with an undo.
 */
export function PlanSteering() {
  const t = useExtracted();
  const steers = useSteers();
  const { change, failed, isPending } = usePlanChange();
  const { plan } = usePlanScreen();

  return (
    <section aria-labelledby="plan-steering-title" className="flex flex-col gap-2">
      <SectionLabel id="plan-steering-title">{t("How is it going?")}</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {steers.map((steer) => (
          <Toggle
            disabled={isPending}
            focusableWhenDisabled
            key={steer.label}
            onPressedChange={() => change([steer.operation(steer.active)])}
            className="aria-pressed:bg-foreground aria-pressed:text-background h-11 px-4"
            pressed={steer.active}
            variant="outline"
          >
            {steer.label}
          </Toggle>
        ))}
      </div>
      {failed && <PlanFailedMessage />}
      <ContentThumbsRow about="plan" target={{ contentId: plan.planId, contentKind: "plan" }} />
    </section>
  );
}
