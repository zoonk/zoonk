"use client";

import { useExtracted } from "next-intl";
import { type GenerationRun, toHeldRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { OnboardingDescription, OnboardingHeading, OnboardingTitle } from "../onboarding-frame";
import { isRunStopped } from "./wait-run";

/** Where the learner goes once the plan is ready: the time question, or the plan itself. */
export type PlanNext = "plan" | "timeQuestion";

export function PlanReadyHeading({ next }: { next: PlanNext }) {
  const t = useExtracted();

  return (
    <OnboardingHeading>
      <OnboardingTitle>{t("Your plan is ready")}</OnboardingTitle>
      <OnboardingDescription>
        {next === "plan"
          ? t("See it whenever you're ready.")
          : t("One last question, then you'll see it.")}
      </OnboardingDescription>
    </OnboardingHeading>
  );
}

export function PlanBuilding({
  holding,
  next,
  run,
}: {
  holding: boolean;
  next: PlanNext;
  run: GenerationRun;
}) {
  const t = useExtracted();

  return (
    <GenerationWait
      doneLabel={holding ? t("Your plan is ready") : undefined}
      kind="curriculum"
      run={holding ? toHeldRun(run) : run}
    >
      {holding ? (
        <PlanReadyHeading next={next} />
      ) : (
        <OnboardingHeading>
          <OnboardingTitle>{t("Building your plan")}</OnboardingTitle>
          <OnboardingDescription>
            {isRunStopped(run)
              ? t("Your answers are saved.")
              : t(
                  "We're choosing what to learn first and fitting it into your days. A new subject can take a minute or two.",
                )}
          </OnboardingDescription>
        </OnboardingHeading>
      )}
    </GenerationWait>
  );
}
