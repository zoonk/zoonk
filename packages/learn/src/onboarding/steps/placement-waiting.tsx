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

/** After this long, offer to go on: placement also runs in the first sessions. */
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

/**
 * While the goal's skill map and placement questions are written: the run's progress as it
 * happens, moving on by itself once questions exist. It never traps the learner: skipping keeps
 * what's known, a failed run offers to start again, and checking that stopped offers to check
 * again.
 */
export function PlacementWaiting({
  buildFailed,
  onSkip,
  poll,
  run,
  skipping,
}: {
  /** Placement says the goal's plan couldn't be built, for hosts that don't follow the run. */
  buildFailed: boolean;
  onSkip: () => void;
  poll: { restart: () => void; status: PollStatus };
  run: GenerationRun | null;
  skipping: boolean;
}) {
  const t = useExtracted();
  const patient = usePatience();
  const shown = getWaitRun({ poll, run: run ?? (buildFailed ? FAILED_RUN : WAITING_RUN) });
  // A test built from the learner's own material has it read first, and an exam's notice is read
  // again when newer instructions read notices better; either takes a few minutes.
  const readsMaterial = shown.steps.readExamNotice !== undefined;
  const readsNotice = shown.steps.readNotice !== undefined;

  return (
    <OnboardingColumn>
      <GenerationWait kind="placement" run={shown}>
        <OnboardingHeading>
          <OnboardingTitle>{t("Getting your questions ready")}</OnboardingTitle>
          <OnboardingDescription>
            {readsMaterial &&
              t("They come from the material you added. Reading it takes a few minutes.")}
            {readsNotice &&
              t(
                "Your questions follow the exam notice, which we're reading now. It takes a few minutes, once per exam.",
              )}
            {!readsMaterial &&
              !readsNotice &&
              t("They come from the skills your goal needs. It usually takes a minute or two.")}
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
