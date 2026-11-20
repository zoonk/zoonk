"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import {
  GenerationTimeline,
  GenerationTimelineHeader,
  GenerationTimelineProgress,
} from "@zoonk/ui/components/generation-timeline";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useAppLocale } from "../../_utils/locale";
import { FollowedRun } from "../../generation/generation-follower";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationFailureNotice, useGenerationProgress } from "../../generation/generation-wait";
import { useVisibleWait } from "../../generation/use-visible-wait";
import { useLearnAnalytics } from "../../learn-context";
import { type GoalError } from "../goal-errors";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { GoalErrorAlert, TypedGoal } from "./goal-outcomes";

const WAITING_RUN: GenerationRun = { failure: null, status: "waiting", steps: {} };

function UnderstandingWaitScreen({
  attemptId,
  onboardingId,
  goal,
  run,
  since,
}: {
  goal: string;
  attemptId?: string;
  onboardingId?: string;
  run: GenerationRun;
  since?: number;
}) {
  const t = useExtracted();
  const locale = useAppLocale();
  const { track } = useLearnAnalytics();
  const progress = useGenerationProgress({ kind: "understanding", run, since });

  useVisibleWait({
    attemptId,
    contentKind: "curriculum",
    onboardingId,
    surface: "understanding",
    track,
  });

  return (
    <OnboardingColumn>
      <TypedGoal goal={goal} />

      <GenerationTimeline>
        <GenerationTimelineHeader>
          <OnboardingHeading>
            <OnboardingTitle>{t("Understanding your goal")}</OnboardingTitle>
            <OnboardingDescription>
              {t("Next, we'll show you what we understood.")}
            </OnboardingDescription>
          </OnboardingHeading>
          <GenerationTimelineProgress
            aria-label={t("Understanding your goal")}
            locale={getFormattingLocale(locale)}
            statuses={["active"]}
            value={progress}
            weights={[1]}
          />
        </GenerationTimelineHeader>
        {run.status === "failed" && (
          <GenerationFailureNotice failure={run.failure ?? "generation"} retry={run.retry} />
        )}
      </GenerationTimeline>
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

export function SendingGoal({
  attemptId,
  goal,
  since,
}: {
  attemptId?: string;
  goal: string;
  since: number;
}) {
  return (
    <UnderstandingWaitScreen attemptId={attemptId} goal={goal} run={WAITING_RUN} since={since} />
  );
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
  sentAt,
  signUpHref,
}: {
  draft: OnboardingDraftView;
  isRetrying: boolean;
  limitError: GoalError | null;
  onReady: () => void;
  onRestart: () => Promise<string | null>;
  onRetry: () => void;
  readFailed: boolean;
  sentAt?: number;
  signUpHref: string;
}) {
  const [startedAgainAt, setStartedAgainAt] = useState<number | null>(null);
  const since = startedAgainAt ?? sentAt;

  const retry = () => {
    setStartedAgainAt(Date.now());
    onRetry();
  };

  const restart = () => {
    setStartedAgainAt(Date.now());
    return onRestart();
  };

  if (limitError) {
    return <UnderstandingLimit error={limitError} goal={draft.prompt} signUpHref={signUpHref} />;
  }

  if (isRetrying) {
    return (
      <UnderstandingWaitScreen
        onboardingId={draft.id}
        goal={draft.prompt}
        run={WAITING_RUN}
        since={since}
      />
    );
  }

  if (readFailed) {
    return (
      <UnderstandingWaitScreen
        onboardingId={draft.id}
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
        restart={restart}
      >
        {(run) => (
          <UnderstandingWaitScreen
            onboardingId={draft.id}
            goal={draft.prompt}
            run={run}
            since={since}
          />
        )}
      </FollowedRun>
    );
  }

  return (
    <UnderstandingWaitScreen
      onboardingId={draft.id}
      goal={draft.prompt}
      run={{
        failure: draft.status === "failed" ? "generation" : "notStarted",
        retry,
        status: "failed",
        steps: {},
      }}
    />
  );
}
