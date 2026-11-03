"use client";

import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationRun, toHeldRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { useReadyHold } from "../../warm-up/use-ready-hold";
import { type OnboardingActions } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding-frame";
import { HeldFooter } from "./held-wait";
import { WAITING_RUN, getWaitRun } from "./wait-run";
import { WaitWarmUp } from "./wait-warm-up";

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

function WaitingDescription({
  holding,
  readsMaterial,
}: {
  holding: boolean;
  readsMaterial: boolean;
}) {
  const t = useExtracted();

  if (holding) {
    return t("Start them whenever you're ready.");
  }

  return readsMaterial
    ? t("They come from the material you added. Reading it takes a few minutes.")
    : t("They come from the skills your goal needs. It usually takes a minute or two.");
}

export function PlacementWaiting({
  buildFailed,
  onQuestions,
  onSkip,
  poll,
  questionsReady,
  readWarmUp,
  run,
  skipping,
}: {
  buildFailed: boolean;
  /** Shows the questions once the wait moves on. */
  onQuestions: () => void;
  onSkip: () => void;
  poll: { restart: () => void; status: PollStatus };
  questionsReady: boolean;
  readWarmUp: OnboardingActions["readWarmUp"];
  run: GenerationRun | null;
  skipping: boolean;
}) {
  const t = useExtracted();
  const patient = usePatience();
  const hold = useReadyHold(questionsReady);
  const holding = hold.status === "hold";
  const shown = getWaitRun({ poll, run: run ?? (buildFailed ? FAILED_RUN : WAITING_RUN) });
  // The learner's own material is read in the `readExamNotice` step.
  const readsMaterial = shown.steps.readExamNotice !== undefined;
  const showQuestions = useEffectEvent(onQuestions);

  useEffect(() => {
    if (hold.status === "go") {
      showQuestions();
    }
  }, [hold.status]);

  return (
    <OnboardingColumn>
      <GenerationWait
        doneLabel={holding ? t("Your questions are ready") : undefined}
        kind="placement"
        run={holding ? toHeldRun(shown) : shown}
      >
        <OnboardingHeading>
          <OnboardingTitle>
            {holding ? t("Your questions are ready") : t("Getting your questions ready")}
          </OnboardingTitle>
          <OnboardingDescription>
            <WaitingDescription holding={holding} readsMaterial={readsMaterial} />
          </OnboardingDescription>
        </OnboardingHeading>
      </GenerationWait>

      <WaitWarmUp hold={hold} read={readWarmUp} surface="placementWait" warmUpId={run?.warmUpId} />

      {holding && <HeldFooter onContinue={hold.release}>{t("Continue")}</HeldFooter>}

      {!holding && (patient || shown.status === "failed") && (
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
