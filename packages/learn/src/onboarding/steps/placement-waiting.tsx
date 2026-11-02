"use client";

import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding-frame";
import { WAITING_RUN, getWaitRun } from "./wait-run";

const PATIENCE_MS = 20_000;

const FAILED_RUN: GenerationRun = { failure: "generation", status: "failed", steps: {} };

function usePatience(): boolean {
  const [patient, setPatient] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPatient(true), PATIENCE_MS);
    return () => clearTimeout(timer);
  }, []);

  return patient;
}

export function PlacementWaiting({
  buildFailed,
  onSkip,
  poll,
  run,
  skipping,
}: {
  buildFailed: boolean;
  onSkip: () => void;
  poll: { restart: () => void; status: PollStatus };
  run: GenerationRun | null;
  skipping: boolean;
}) {
  const t = useExtracted();
  const patient = usePatience();
  const shown = getWaitRun({ poll, run: run ?? (buildFailed ? FAILED_RUN : WAITING_RUN) });
  // The learner's own material is read in the `readExamNotice` step.
  const readsMaterial = shown.steps.readExamNotice !== undefined;

  return (
    <OnboardingColumn>
      <GenerationWait kind="placement" run={shown}>
        <OnboardingHeading>
          <OnboardingTitle>{t("Getting your questions ready")}</OnboardingTitle>
          <OnboardingDescription>
            {readsMaterial
              ? t("They come from the material you added. Reading it takes a few minutes.")
              : t("They come from the skills your goal needs. It usually takes a minute or two.")}
          </OnboardingDescription>
        </OnboardingHeading>
      </GenerationWait>

      {(patient || shown.status === "failed") && (
        <OnboardingFooter>
          <OnboardingSecondaryButton disabled={skipping} onClick={onSkip}>
            {t("Skip for now")}
          </OnboardingSecondaryButton>
          <p className="text-muted-foreground text-center text-sm text-pretty">
            {t("Your first sessions will ask a few of these instead.")}
          </p>
        </OnboardingFooter>
      )}
    </OnboardingColumn>
  );
}
