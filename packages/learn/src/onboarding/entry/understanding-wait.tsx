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

const WAITING_RUN: GenerationRun = { failure: null, status: "waiting", steps: {} };

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

export function SendingGoal({ goal }: { goal: string }) {
  return <UnderstandingWaitScreen goal={goal} run={WAITING_RUN} />;
}

/**
 * Only follows the read: one that failed or never started waits for the learner's "Try again",
 * since starting it is new work.
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
  limitError: GoalError | null;
  onReady: () => void;
  onRestart: () => Promise<string | null>;
  onRetry: () => void;
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
