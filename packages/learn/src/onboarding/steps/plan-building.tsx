"use client";

import { useExtracted } from "next-intl";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { isRunStopped } from "./wait-run";

export function PlanBuilding({
  children,
  run,
}: {
  children?: React.ReactNode;
  run: GenerationRun;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <GenerationWait kind="curriculum" run={run}>
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
      </GenerationWait>
      {children}
    </OnboardingColumn>
  );
}
