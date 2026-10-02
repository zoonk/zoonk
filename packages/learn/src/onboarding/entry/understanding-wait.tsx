"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { FollowedRun } from "../../generation/generation-follower";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { type GoalError } from "../goal-errors";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { GoalErrorAlert, TypedGoal } from "./goal-outcomes";

/** Before a run is known: the goal was just sent, or its run is starting again. */
const WAITING_RUN: GenerationRun = { failure: null, status: "waiting", steps: {} };

/** The wait itself: the learner's words, then how far reading them got. */
function UnderstandingWaitScreen({ goal, run }: { goal: string; run: GenerationRun }) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <TypedGoal goal={goal} />

      <GenerationWait kind="understanding" run={run}>
        <OnboardingHeading>
          <OnboardingTitle>{t("Understanding your goal")}</OnboardingTitle>
          <OnboardingDescription>{t("Next, you check what we understood.")}</OnboardingDescription>
        </OnboardingHeading>
      </GenerationWait>
    </OnboardingColumn>
  );
}

/** No more new goals can be read today: why, and for a guest, the way to an account. */
function UnderstandingLimit({
  error,
  goal,
  signUpHref,
}: {
  error: GoalError;
  goal: string;
  signUpHref: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <TypedGoal goal={goal} />

      <OnboardingHeading>
        <OnboardingTitle>{t("Understanding your goal")}</OnboardingTitle>
      </OnboardingHeading>

      <GoalErrorAlert error={error} signUpHref={signUpHref} />
    </OnboardingColumn>
  );
}

/** Right after sending, before the draft exists. */
export function SendingGoal({ goal }: { goal: string }) {
  return <UnderstandingWaitScreen goal={goal} run={WAITING_RUN} />;
}

/**
 * A draft whose words are still being read, or couldn't be. A running read is followed live and
 * moves on by itself (`onReady`); one that failed or never started waits for the learner's "Try
 * again" (`onRetry`), since starting it is new work. After a refresh this only follows: it never
 * starts anything on its own.
 */
export function UnderstandingWait({
  draft,
  isRetrying,
  limitError,
  onReady,
  onRestart,
  onRetry,
  readFailed,
  signUpHref,
}: {
  draft: OnboardingDraftView;
  isRetrying: boolean;
  /** Starting it again hit the day's limit: why, with the way to an account for a guest. */
  limitError: GoalError | null;
  onReady: () => void;
  /** Starts the read again from the follower's "Try again"; resolves to the new run's id. */
  onRestart: () => Promise<string | null>;
  onRetry: () => void;
  /** The read finished, but its result couldn't be loaded. */
  readFailed: boolean;
  signUpHref: string;
}) {
  if (limitError) {
    return <UnderstandingLimit error={limitError} goal={draft.prompt} signUpHref={signUpHref} />;
  }

  if (isRetrying) {
    return <UnderstandingWaitScreen goal={draft.prompt} run={WAITING_RUN} />;
  }

  if (readFailed) {
    return (
      <UnderstandingWaitScreen
        goal={draft.prompt}
        run={{ failure: "connection", retry: onReady, status: "failed", steps: {} }}
      />
    );
  }

  if (draft.status === "understanding" && draft.generationId) {
    return (
      <FollowedRun
        generationId={draft.generationId}
        key={draft.generationId}
        kind="understanding"
        onReady={onReady}
        restart={onRestart}
      >
        {(run) => <UnderstandingWaitScreen goal={draft.prompt} run={run} />}
      </FollowedRun>
    );
  }

  return (
    <UnderstandingWaitScreen
      goal={draft.prompt}
      run={{
        failure: draft.status === "failed" ? "generation" : "notStarted",
        retry: onRetry,
        status: "failed",
        steps: {},
      }}
    />
  );
}
