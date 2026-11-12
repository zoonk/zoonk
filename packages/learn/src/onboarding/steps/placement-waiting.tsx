"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { ChangeSaveError } from "../../_components/save-error";
import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationRun, toHeldRun } from "../../generation/generation-run";
import {
  GenerationFailureNotice,
  GenerationWait,
  useGenerationProgress,
} from "../../generation/generation-wait";
import { useReadyHold } from "../../wait/use-ready-hold";
import { useDeck } from "../../wait/wait-deck";
import {
  WaitAside,
  WaitContent,
  WaitScreen,
  WaitSlot,
  useWaitScreen,
} from "../../wait/wait-screen";
import { WaitStatus } from "../../wait/wait-status";
import { type OnboardingActions } from "../onboarding-actions";
import { useOnboardingWait } from "../onboarding-clock";
import {
  OnboardingColumn,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
} from "../onboarding-frame";
import { useOnboardingHost } from "../onboarding-host";
import { useOnboardingRail } from "../onboarding-rail";
import { WaitBackToQuiz, WaitBar, WaitHeading } from "./wait-parts";
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

function PlacementProgress({
  holding,
  run,
  since,
}: {
  holding: boolean;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();
  // The learner's own material is read in the `readExamNotice` step.
  const readsMaterial = run.steps.readExamNotice !== undefined;

  const description = readsMaterial
    ? t("Reading your material takes a few minutes.")
    : t("This takes a minute or two.");

  return (
    <GenerationWait
      doneLabel={holding ? t("Your test is ready") : undefined}
      kind="placement"
      run={holding ? toHeldRun(run) : run}
      since={since}
    >
      <WaitHeading
        description={holding ? null : description}
        title={holding ? t("Your test is ready") : t("Getting your test ready")}
      />
    </GenerationWait>
  );
}

function PlacementStatus({
  holding,
  run,
  since,
}: {
  holding: boolean;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();

  const value = useGenerationProgress({
    kind: "placement",
    run: holding ? toHeldRun(run) : run,
    since,
  });

  if (!holding && run.status === "failed") {
    return <GenerationFailureNotice failure={run.failure ?? "generation"} retry={run.retry} />;
  }

  return (
    <WaitStatus done={holding} value={value}>
      {holding ? t("Your test is ready") : t("Getting your test ready")}
    </WaitStatus>
  );
}

function PlacementBar({
  canSkip,
  holding,
  onSkip,
  skipLabel,
  skipFailed,
  skipping,
}: {
  canSkip: boolean;
  holding: boolean;
  onSkip: () => void;
  skipLabel?: string;
  skipFailed: boolean;
  skipping: boolean;
}) {
  const t = useExtracted();
  const { release, slotShown } = useWaitScreen();

  if (holding) {
    return (
      <WaitBar>
        <OnboardingPrimaryButton className="lg:w-auto lg:min-w-40" onClick={release}>
          {t("Continue")}
        </OnboardingPrimaryButton>
      </WaitBar>
    );
  }

  if (!canSkip && !slotShown) {
    return null;
  }

  return (
    <WaitBar>
      <WaitSlot />

      {canSkip && (
        <div className="flex flex-col gap-1 lg:items-end">
          <OnboardingSecondaryButton className="lg:w-auto" disabled={skipping} onClick={onSkip}>
            {skipLabel ?? t("Skip")}
          </OnboardingSecondaryButton>
          {skipFailed && <ChangeSaveError className="text-center lg:text-right" />}
        </div>
      )}
    </WaitBar>
  );
}

function PlacementWaitPage({
  canSkip,
  holding,
  onSkip,
  run,
  skipLabel,
  skipFailed,
  skipping,
}: {
  canSkip: boolean;
  holding: boolean;
  onSkip: () => void;
  run: GenerationRun;
  skipLabel?: string;
  skipFailed: boolean;
  skipping: boolean;
}) {
  const since = useMountTime().getTime();
  const flowRail = useOnboardingRail();
  const progress = <PlacementProgress holding={holding} run={run} since={since} />;

  return (
    <WaitBackToQuiz>
      <OnboardingColumn
        bar={
          <PlacementBar
            canSkip={canSkip}
            holding={holding}
            onSkip={onSkip}
            skipLabel={skipLabel}
            skipFailed={skipFailed}
            skipping={skipping}
          />
        }
        rail={
          <>
            <WaitAside>{progress}</WaitAside>
            {flowRail}
          </>
        }
      >
        <WaitContent
          progress={progress}
          status={<PlacementStatus holding={holding} run={run} since={since} />}
        />
      </OnboardingColumn>
    </WaitBackToQuiz>
  );
}

export function PlacementWaiting({
  buildFailed,
  onQuestions,
  onSkip,
  poll,
  questionsReady,
  readWarmUp,
  run,
  skipLabel,
  skipFailed = false,
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
  /** What leaving the wait is called, when it isn't placement's own skip. */
  skipLabel?: string;
  /** Leaving didn't save: said beside the control, which stays the retry. */
  skipFailed?: boolean;
  skipping: boolean;
}) {
  const patient = usePatience();
  const hold = useReadyHold(questionsReady);
  const aside = useOnboardingHost()?.kind === "page";
  useOnboardingWait("placementWait", hold.status !== "go");
  const shown = getWaitRun({ poll, run: run ?? (buildFailed ? FAILED_RUN : WAITING_RUN) });
  const { coming, deck } = useDeck({ readDeck: readWarmUp, run: shown });
  const showQuestions = useEffectEvent(onQuestions);
  const holding = hold.status === "hold";

  useEffect(() => {
    if (hold.status === "go") {
      showQuestions();
    }
  }, [hold.status]);

  return (
    <WaitScreen aside={aside} coming={coming} deck={deck} hold={hold} surface="placementWait">
      <PlacementWaitPage
        canSkip={!holding && (patient || shown.status === "failed")}
        holding={holding}
        onSkip={onSkip}
        run={shown}
        skipLabel={skipLabel}
        skipFailed={skipFailed}
        skipping={skipping}
      />
    </WaitScreen>
  );
}
