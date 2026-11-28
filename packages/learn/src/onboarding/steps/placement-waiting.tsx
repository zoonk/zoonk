"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent } from "react";
import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationKind } from "../../generation/generation-kinds";
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

type PlacementWaitKind = Extract<GenerationKind, "placement" | "placementQuestions">;

const FAILED_RUN: GenerationRun = { failure: "generation", status: "failed", steps: {} };

function PlacementProgress({
  holding,
  kind,
  run,
  since,
}: {
  holding: boolean;
  kind: PlacementWaitKind;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();
  // The learner's own material is read in the `readExamNotice` step.
  const readsMaterial = run.steps.readExamNotice !== undefined;

  const description = readsMaterial
    ? t("Reading your material takes a few minutes.")
    : t({
        description:
          "Shown while the learner waits for their first questions to be prepared. “This” is the wait.",
        message: "This takes a minute or two.",
      });

  return (
    <GenerationWait
      doneLabel={holding ? t("Your test is ready") : undefined}
      kind={kind}
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
  kind,
  run,
  since,
}: {
  holding: boolean;
  kind: PlacementWaitKind;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();

  const value = useGenerationProgress({ kind, run: holding ? toHeldRun(run) : run, since });

  if (!holding && run.status === "failed") {
    return <GenerationFailureNotice failure={run.failure ?? "generation"} retry={run.retry} />;
  }

  return (
    <WaitStatus done={holding} value={value}>
      {holding ? t("Your test is ready") : t("Getting your test ready")}
    </WaitStatus>
  );
}

type WaitLeave = { label: string; note: string | null };

/** The way on from a wait, there from the start: the test stays open and is taken later. */
export function useWaitLeave(onboarding: boolean): WaitLeave {
  const t = useExtracted();

  return onboarding
    ? { label: t("Skip"), note: t("You can take the test later, from your plan.") }
    : { label: t("Not now"), note: null };
}

function PlacementBar({
  holding,
  onSkip,
  skip,
  skipFailed,
  skipping,
}: {
  holding: boolean;
  onSkip: () => void;
  skip: WaitLeave;
  skipFailed: boolean;
  skipping: boolean;
}) {
  const t = useExtracted();
  const { release } = useWaitScreen();

  if (holding) {
    return (
      <WaitBar>
        <OnboardingPrimaryButton onClick={release}>{t("Continue")}</OnboardingPrimaryButton>
      </WaitBar>
    );
  }

  return (
    <WaitBar failed={skipFailed} note={skip.note}>
      <WaitSlot />

      <OnboardingSecondaryButton busy={skipping} onClick={onSkip}>
        {skip.label}
      </OnboardingSecondaryButton>
    </WaitBar>
  );
}

function PlacementWaitPage({
  holding,
  kind,
  onSkip,
  run,
  skip,
  skipFailed,
  skipping,
}: {
  holding: boolean;
  kind: PlacementWaitKind;
  onSkip: () => void;
  run: GenerationRun;
  skip: WaitLeave;
  skipFailed: boolean;
  skipping: boolean;
}) {
  const since = useMountTime().getTime();
  const flowRail = useOnboardingRail();
  const progress = <PlacementProgress holding={holding} kind={kind} run={run} since={since} />;

  return (
    <WaitBackToQuiz>
      <OnboardingColumn
        bar={
          <PlacementBar
            holding={holding}
            onSkip={onSkip}
            skip={skip}
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
          status={<PlacementStatus holding={holding} kind={kind} run={run} since={since} />}
        />
      </OnboardingColumn>
    </WaitBackToQuiz>
  );
}

export function PlacementWaiting({
  buildFailed,
  existingPlan = false,
  onQuestions,
  onSkip,
  poll,
  questionsReady,
  readWarmUp,
  retry,
  run,
  skip,
  skipFailed = false,
  skipping,
}: {
  buildFailed: boolean;
  existingPlan?: boolean;
  /** Shows the questions once the wait moves on. */
  onQuestions: () => void;
  onSkip: () => void;
  poll: { restart: () => void; status: PollStatus };
  questionsReady: boolean;
  readWarmUp: OnboardingActions["readWarmUp"];
  /** The test couldn't start, or its questions couldn't be written: the wait offers "Try again". */
  retry?: () => void;
  run: GenerationRun | null;
  /** What leaving the wait is called, and the line beside it. */
  skip: WaitLeave;
  /** Leaving didn't save: said beside the control, which stays the retry. */
  skipFailed?: boolean;
  skipping: boolean;
}) {
  const hold = useReadyHold(questionsReady);
  const aside = useOnboardingHost()?.kind === "page";
  useOnboardingWait("placementWait", hold.status !== "go");
  const stopped = retry ? { ...FAILED_RUN, retry } : null;

  const shown = getWaitRun({
    poll,
    run: stopped ?? run ?? (buildFailed ? FAILED_RUN : WAITING_RUN),
  });

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
        holding={holding}
        kind={existingPlan ? "placementQuestions" : "placement"}
        onSkip={onSkip}
        run={shown}
        skip={skip}
        skipFailed={skipFailed}
        skipping={skipping}
      />
    </WaitScreen>
  );
}
