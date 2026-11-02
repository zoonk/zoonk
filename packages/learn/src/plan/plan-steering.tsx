"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import { Toggle } from "@zoonk/ui/components/toggle";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { usePlanScreen } from "./plan-context";
import { useDifficultySentence } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";
import { useTappedChoice } from "./use-tapped-choice";

type SteerOperation = Extract<
  LearnerPlanOperation,
  { kind: "setDifficultyBias" | "setPracticeBias" }
>;

type Steering = Pick<PlanView["steering"], "difficultyBias" | "practiceBias">;

type Steer = {
  active: boolean;
  label: string;
  /** Tapping an active choice goes back to the default. */
  operation: (active: boolean) => SteerOperation;
};

function applySteer(steering: Steering, operation: SteerOperation): Steering {
  return operation.kind === "setDifficultyBias"
    ? { ...steering, difficultyBias: operation.bias }
    : { ...steering, practiceBias: operation.bias };
}

function useSteers({ difficultyBias, practiceBias }: Steering): Steer[] {
  const t = useExtracted();

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

export function PlanSteering() {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const asked = useTappedChoice<SteerOperation | null>(null);
  const steering = asked.shown ? applySteer(plan.steering, asked.shown) : plan.steering;
  const steers = useSteers(steering);
  const difficultySentence = useDifficultySentence();
  const { difficultyBias } = steering;

  if (plan.steering.lessonsStudied === 0) {
    return null;
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("How is it going?")}</legend>
      <div className="flex flex-wrap gap-2">
        {steers.map((steer) => (
          <Toggle
            className="h-11 px-4"
            disabled={isPending}
            focusableWhenDisabled
            key={steer.label}
            onPressedChange={() => {
              const operation = steer.operation(steer.active);
              void change([operation], asked.pick(operation));
            }}
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

      {failed && <ChangeSaveError />}
    </fieldset>
  );
}
