"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
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
    ? t("They come from the material you added. Reading it takes a few minutes.")
    : t("They come from the skills your goal needs. It usually takes a minute or two.");

  return (
    <GenerationWait
      doneLabel={holding ? t("Your questions are ready") : undefined}
      kind="placement"
      run={holding ? toHeldRun(run) : run}
      since={since}
    >
      <WaitHeading
        description={holding ? t("Start them whenever you're ready.") : description}
        title={holding ? t("Your questions are ready") : t("Getting your questions ready")}
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
      {holding ? t("Your questions are ready") : t("Getting your questions ready")}
    </WaitStatus>
  );
}

function PlacementBar({
  canSkip,
  holding,
  onSkip,
  skipping,
}: {
  canSkip: boolean;
  holding: boolean;
  onSkip: () => void;
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
            {t("Skip for now")}
          </OnboardingSecondaryButton>
          <p className="text-muted-foreground text-center text-sm text-pretty lg:text-right">
            {t("Your first sessions will ask a few of these instead.")}
          </p>
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
  skipping,
}: {
  canSkip: boolean;
  holding: boolean;
  onSkip: () => void;
  run: GenerationRun;
  skipping: boolean;
}) {
  const since = useMountTime().getTime();
  const flowRail = useOnboardingRail();
  const progress = <PlacementProgress holding={holding} run={run} since={since} />;

  return (
    <WaitBackToQuiz>
      <OnboardingColumn
        bar={
          <PlacementBar canSkip={canSkip} holding={holding} onSkip={onSkip} skipping={skipping} />
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
  const patient = usePatience();
  const hold = useReadyHold(questionsReady);
  const deck = useDeck({ readDeck: readWarmUp, warmUpId: run?.warmUpId });
  const aside = useOnboardingHost()?.kind === "page";
  useOnboardingWait("placementWait", hold.status !== "go");
  const shown = getWaitRun({ poll, run: run ?? (buildFailed ? FAILED_RUN : WAITING_RUN) });
  const showQuestions = useEffectEvent(onQuestions);
  const holding = hold.status === "hold";

  useEffect(() => {
    if (hold.status === "go") {
      showQuestions();
    }
  }, [hold.status]);

  return (
    <WaitScreen aside={aside} deck={deck} hold={hold} surface="placementWait">
      <PlacementWaitPage
        canSkip={!holding && (patient || shown.status === "failed")}
        holding={holding}
        onSkip={onSkip}
        run={shown}
        skipping={skipping}
      />
    </WaitScreen>
  );
}
