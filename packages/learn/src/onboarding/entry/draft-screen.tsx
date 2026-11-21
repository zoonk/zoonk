"use client";

import {
  type GoalUnderstandingView,
  type OnboardingDraftView,
} from "@zoonk/core/view-models/onboarding/contract";
import { useState, useTransition } from "react";
import { useAppLocale } from "../../_utils/locale";
import { type GoalError } from "../goal-errors";
import {
  type CreateGoalsOutcome,
  type GoalLimit,
  type OnboardingActions,
  type OnboardingRoutes,
  type WaitlistOutcome,
} from "../onboarding-actions";
import { toGoalCreateInput, toUnderstandingDraft } from "../understood/understanding-draft";
import { UnderstoodScreen } from "../understood/understood-screen";
import { useDraftGoals } from "./draft-goals";
import { DeclinedGoal, ExplainGoal, InstrumentGoal, UnclearGoal } from "./goal-outcomes";
import { getSentGoal } from "./understanding-start";
import { UnderstandingWait } from "./understanding-wait";
import { type useDraftActions } from "./use-draft-actions";

type DraftActions = ReturnType<typeof useDraftActions>;

type Creation = {
  error: GoalError | null;
  isCreating: boolean;
  run: (run: () => Promise<CreateGoalsOutcome>) => void;
  startExplanation: (input: { draft: OnboardingDraftView; question: string }) => void;
};

type DraftStepProps = {
  actions: OnboardingActions;
  creation: Creation;
  draft: OnboardingDraftView;
  draftActions: DraftActions;
  goalLimit: GoalLimit | null;
  hasAccount: boolean;
  onBack: () => void;
  onRewrite: (words: string) => void;
  routes: OnboardingRoutes;
};

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
  const locale = useAppLocale();
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
          setWaitlist(
            await actions
              .joinWaitlist({ instrument, language: locale })
              .catch((): WaitlistOutcome => "failed"),
          );
        })
      }
      onStartMusicianship={() => creation.run(() => createMusicianship({ draft, instrument }))}
      signUpHref={routes.signUp}
      waitlist={waitlist}
    />
  );
}

function ReadDraft({
  actions,
  creation,
  draft,
  draftActions,
  goalLimit,
  hasAccount,
  onBack,
  onRewrite,
  routes,
  understanding,
}: DraftStepProps & { understanding: GoalUnderstandingView }) {
  switch (understanding.status) {
    case "goals": {
      const card = toUnderstandingDraft({
        activeGoalsLeft: draft.activeGoalsLeft,
        timeZone: draft.timeZone,
        understanding,
      });

      return (
        <UnderstoodScreen
          draft={card}
          error={creation.error}
          goal={draft.prompt}
          goalLimit={goalLimit}
          hasAccount={hasAccount}
          isCreating={creation.isCreating}
          material={draft.sources}
          onConfirm={() => creation.run(() => actions.createGoals(toGoalCreateInput(card)))}
          onRevise={draftActions.revise}
          onRewrite={onRewrite}
          signUpHref={routes.signUp}
        />
      );
    }
    case "explain":
      return (
        <ExplainGoal
          error={creation.error}
          goal={draft.prompt}
          isStarting={creation.isCreating || getSentGoal(draft.id) !== null}
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

export function DraftScreen({
  draft,
  draftActions,
  sentAt,
  ...props
}: DraftStepProps & { sentAt?: number }) {
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
        sentAt={sentAt}
        signUpHref={props.routes.signUp}
      />
    );
  }

  return (
    <ReadDraft draft={draft} draftActions={draftActions} understanding={understanding} {...props} />
  );
}
