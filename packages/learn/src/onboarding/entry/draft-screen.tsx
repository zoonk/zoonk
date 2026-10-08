"use client";

import {
  type GoalUnderstandingView,
  type OnboardingDraftView,
} from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { type GoalError } from "../goal-errors";
import {
  type AttachedSource,
  type CreateGoalsOutcome,
  type OnboardingActions,
  type OnboardingRoutes,
  type WaitlistOutcome,
} from "../onboarding-actions";
import { toGoalCreateInput, toUnderstandingDraft } from "../understood/understanding-draft";
import { UnderstoodScreen } from "../understood/understood-screen";
import { useDraftGoals } from "./draft-goals";
import { DeclinedGoal, ExplainGoal, InstrumentGoal, UnclearGoal } from "./goal-outcomes";
import { type MaterialIntent } from "./material-intent";
import { UnderstandingWait } from "./understanding-wait";
import { type useDraftActions } from "./use-draft-actions";

type DraftActions = ReturnType<typeof useDraftActions>;

type Creation = {
  error: GoalError | null;
  isCreating: boolean;
  /** Creates goals, then goes on to their steps. */
  run: (run: () => Promise<CreateGoalsOutcome>) => void;
  startExplanation: (input: { draft: OnboardingDraftView; question: string }) => void;
};

/** An instrument: musicianship to start today, and the waitlist for playing. */
function InstrumentDraft({
  actions,
  creation,
  draft,
  instrument,
  routes,
}: {
  actions: OnboardingActions;
  creation: Creation;
  draft: OnboardingDraftView;
  instrument: string;
  routes: OnboardingRoutes;
}) {
  const locale = useLocale();
  const { createMusicianship } = useDraftGoals(actions);
  const [waitlist, setWaitlist] = useState<WaitlistOutcome | null>(null);
  const [isJoining, startJoining] = useTransition();

  return (
    <InstrumentGoal
      error={creation.error}
      goal={draft.prompt}
      instrument={instrument}
      isJoining={isJoining}
      isStarting={creation.isCreating}
      onJoinWaitlist={() =>
        startJoining(async () => {
          setWaitlist(await actions.joinWaitlist({ instrument, language: locale }));
        })
      }
      onStartMusicianship={() => creation.run(() => createMusicianship({ draft, instrument }))}
      signUpHref={routes.signUp}
      waitlist={waitlist}
    />
  );
}

/** What a read draft turned out to be, each with its own next step. */
function ReadDraft({
  actions,
  attached,
  creation,
  draft,
  draftActions,
  intent,
  onBack,
  onRewrite,
  routes,
  understanding,
}: {
  actions: OnboardingActions;
  attached: AttachedSource[];
  creation: Creation;
  draft: OnboardingDraftView;
  draftActions: DraftActions;
  intent: MaterialIntent | null;
  onBack: () => void;
  onRewrite: (words: string) => void;
  routes: OnboardingRoutes;
  understanding: GoalUnderstandingView;
}) {
  switch (understanding.status) {
    case "goals":
      return (
        <UnderstoodScreen
          draft={toUnderstandingDraft(understanding)}
          error={creation.error}
          goal={draft.prompt}
          isCreating={creation.isCreating}
          material={attached}
          onConfirm={() =>
            creation.run(() =>
              actions.createGoals(
                toGoalCreateInput({
                  draft: toUnderstandingDraft(understanding),
                  materialIntent: attached.length > 0 ? intent : null,
                  sourceIds: attached.map((source) => source.id),
                  timeZone: getLocalTimeZone(),
                }),
              ),
            )
          }
          onRevise={draftActions.revise}
          onRewrite={onRewrite}
          signUpHref={routes.signUp}
        />
      );
    case "explain":
      return (
        <ExplainGoal
          error={creation.error}
          goal={draft.prompt}
          isStarting={creation.isCreating}
          onStart={() => creation.startExplanation({ draft, question: understanding.question })}
          question={understanding.question}
          signUpHref={routes.signUp}
        />
      );
    case "instrument":
      return (
        <InstrumentDraft
          actions={actions}
          creation={creation}
          draft={draft}
          instrument={understanding.instrument}
          routes={routes}
        />
      );
    case "unsafe":
      return <DeclinedGoal goal={draft.prompt} onRetry={onBack} />;
    case "unclear":
      return <UnclearGoal goal={draft.prompt} onRetry={onBack} />;
    default:
      return <UnclearGoal goal={draft.prompt} onRetry={onBack} />;
  }
}

/**
 * The typed goal as its draft says now: the wait while its words are read (or the way to try
 * again), then what they turned out to be.
 */
export function DraftScreen({
  draft,
  draftActions,
  ...props
}: {
  actions: OnboardingActions;
  attached: AttachedSource[];
  creation: Creation;
  draft: OnboardingDraftView;
  draftActions: DraftActions;
  intent: MaterialIntent | null;
  onBack: () => void;
  onRewrite: (words: string) => void;
  routes: OnboardingRoutes;
}) {
  const understanding = draft.status === "understood" ? draft.understanding : null;

  if (!understanding) {
    return (
      <UnderstandingWait
        draft={draft}
        isRetrying={draftActions.isRetrying}
        limitError={draftActions.limit}
        onReady={() => void draftActions.loadRead()}
        onRestart={draftActions.restart}
        onRetry={draftActions.retry}
        readFailed={draftActions.readFailed}
        signUpHref={props.routes.signUp}
      />
    );
  }

  return (
    <ReadDraft draft={draft} draftActions={draftActions} understanding={understanding} {...props} />
  );
}
