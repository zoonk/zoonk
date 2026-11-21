"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useEffect, useEffectEvent, useState } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useDraftGoals } from "./entry/draft-goals";
import { DraftScreen } from "./entry/draft-screen";
import { GoalStartEntry } from "./entry/goal-attachments";
import { GoalExamples } from "./entry/goal-examples";
import { GuestGoalGate } from "./entry/guest-goal-gate";
import { toDraftMaterial, useStartMaterial, useSubmitGoal } from "./entry/material-goal";
import { MaterialQuestions } from "./entry/material-questions";
import { forgetHandedOffGoal, getHandedOffGoal, getSentGoal } from "./entry/understanding-start";
import { SendingGoal } from "./entry/understanding-wait";
import { useDraftActions } from "./entry/use-draft-actions";
import { useFollowSavedDraft } from "./entry/use-follow-saved-draft";
import { useGoalCreation } from "./entry/use-goal-creation";
import { useSubmitUnderstanding } from "./entry/use-submit-understanding";
import { type GoalError } from "./goal-errors";
import { OnboardingHowItWorks } from "./how-it-works";
import {
  type GoalLimit,
  type OnboardingActions,
  type OnboardingNavigation,
  type OnboardingRoutes,
} from "./onboarding-actions";
import { OnboardingFrame } from "./onboarding-frame";
import { useOnboardingSection } from "./onboarding-host";
import { OnboardingRailProvider } from "./onboarding-rail";
import { useFocusTitleOnNewScreen } from "./use-focus-title";

type StartState =
  | { error: GoalError | null; kind: "entry"; words: string }
  | { kind: "questions" }
  | { attemptId?: string; goal: string; kind: "sending"; sentAt: number }
  | { draft: OnboardingDraftView; kind: "draft"; sentAt?: number };

function getInitialState({
  defaultGoal,
  initialDraft,
  takesHandedOffGoal,
}: {
  defaultGoal: string;
  initialDraft: OnboardingDraftView | null;
  takesHandedOffGoal: boolean;
}): StartState {
  if (initialDraft) {
    return { draft: initialDraft, kind: "draft", sentAt: getSentGoal(initialDraft.id)?.sentAt };
  }

  const handedOff = takesHandedOffGoal ? getHandedOffGoal() : null;

  return handedOff
    ? {
        attemptId: handedOff.attemptId,
        goal: handedOff.goal,
        kind: "sending",
        sentAt: handedOff.sentAt,
      }
    : { error: null, kind: "entry", words: defaultGoal };
}

/** The draft's read goes on from the wait its send began, so its bar never starts over. */
function toDraftState({
  current,
  draft,
}: {
  current: StartState;
  draft: OnboardingDraftView;
}): StartState {
  const sentAt =
    current.kind === "sending" || (current.kind === "draft" && current.draft.id === draft.id)
      ? current.sentAt
      : undefined;

  return { draft, kind: "draft", sentAt };
}

function getScreenKey(state: StartState): string {
  if (state.kind === "draft") {
    return state.draft.status === "understood" ? `${state.draft.id}:read` : "wait";
  }

  return state.kind;
}

function getBack({
  editDraft,
  showEntry,
  state,
}: {
  editDraft: (draft: OnboardingDraftView) => void;
  showEntry: (entry: { words: string }) => void;
  state: StartState;
}): (() => void) | undefined {
  if (state.kind === "questions") {
    return () => showEntry({ words: "" });
  }

  return state.kind === "draft" ? () => editDraft(state.draft) : undefined;
}

export function StartFlow({
  needsAccount = false,
  ...props
}: React.ComponentProps<typeof GoalStartFlow> & { needsAccount?: boolean }) {
  if (needsAccount) {
    return (
      <OnboardingFrame>
        <GuestGoalGate routes={props.routes} />
      </OnboardingFrame>
    );
  }

  return <GoalStartFlow {...props} />;
}

/**
 * A goal sent from another page goes on here; a replayed mount, or the page shown again after the
 * learner went elsewhere, follows the same send again until its outcome is taken.
 */
function useFollowHandedOffGoal({
  follow,
  takes,
}: {
  follow: ReturnType<typeof useSubmitUnderstanding>["follow"];
  takes: boolean;
}) {
  const followHandedOff = useEffectEvent(async (signal: AbortSignal) => {
    const handedOff = takes ? getHandedOffGoal() : null;

    if (!handedOff) {
      return;
    }

    await follow({ ...handedOff, signal });

    if (!signal.aborted) {
      forgetHandedOffGoal(handedOff);
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    void followHandedOff(controller.signal);
    return () => controller.abort();
  }, []);
}

type GoalStartFlowProps = {
  actions: OnboardingActions;
  /** `null` is the resolved default buddy; `undefined` isn't known yet. */
  buddy?: LearnBuddy | null;
  canAttach?: boolean;
  defaultGoal?: string;
  fromSharedPlan?: boolean;
  goalLimit?: GoalLimit | null;
  initialDraft?: OnboardingDraftView | null;
  navigation: OnboardingNavigation;
  routes: OnboardingRoutes;
  /** `/start` itself, which shows the goal another page sent; never a flow embedded in another page. */
  takesHandedOffGoal?: boolean;
};

/** Embedded in another page, the goal box has no room for examples, so they go beside it. */
function SectionExamples({ onPick }: { onPick: (goal: string) => void }) {
  return useOnboardingSection() ? <GoalExamples onPick={onPick} /> : null;
}

/** "How it works" describes a plan's path, which an explanation offer doesn't have. */
function showsRail({ atGoalLimit, state }: { atGoalLimit: boolean; state: StartState }): boolean {
  const offersExplanation =
    state.kind === "draft" &&
    state.draft.status === "understood" &&
    state.draft.understanding?.status === "explain";

  return !atGoalLimit && !offersExplanation;
}

function GoalStartFlow({
  actions,
  buddy,
  canAttach = false,
  defaultGoal = "",
  fromSharedPlan = false,
  goalLimit = null,
  initialDraft = null,
  navigation,
  routes,
  takesHandedOffGoal = false,
}: GoalStartFlowProps) {
  const creation = useGoalCreation();
  const { createExplanation } = useDraftGoals(actions);
  const material = useStartMaterial();

  const [state, setState] = useState<StartState>(() =>
    getInitialState({ defaultGoal, initialDraft, takesHandedOffGoal }),
  );

  useFocusTitleOnNewScreen(getScreenKey(state));

  const takeDraft = (draft: OnboardingDraftView) => {
    creation.clearActiveGoalsError(draft);
    setState((current) => toDraftState({ current, draft }));
  };

  const savedDraft = useFollowSavedDraft({
    follow: takeDraft,
    initialDraft,
    shown: state.kind === "draft" ? state.draft : null,
  });

  const showDraft = (draft: OnboardingDraftView) => {
    navigation.showDraft(draft.id);
    savedDraft.markOwn();
    takeDraft(draft);
  };

  const draftActions = useDraftActions({
    draft: state.kind === "draft" ? state.draft : null,
    onDraft: showDraft,
    understanding: actions.understanding,
  });

  const showEntry = ({ error = null, words }: { error?: GoalError | null; words: string }) => {
    draftActions.cancel();
    submission.cancel();
    navigation.showDraft(null);
    creation.clearError();
    setState({ error, kind: "entry", words });
  };

  const startExplanation = ({
    draft,
    question,
  }: {
    draft: OnboardingDraftView;
    question: string;
  }) =>
    creation.create({
      onCreated: navigation.toExplanation,
      run: () => createExplanation({ draft, question }),
    });

  const submission = useSubmitUnderstanding({
    draftId: state.kind === "draft" ? state.draft.id : null,
    onDraft: showDraft,
    onError: showEntry,
    onExplanation: startExplanation,
    onSending: ({ attemptId, goal, sentAt }) => {
      draftActions.cancel();
      setState({ attemptId, goal, kind: "sending", sentAt });
    },
    understanding: actions.understanding,
  });

  const shownDraft = state.kind === "draft" ? state.draft : null;
  const settleShown = useEffectEvent((draft: OnboardingDraftView) => submission.settle(draft));

  useFollowHandedOffGoal({
    follow: submission.follow,
    takes: takesHandedOffGoal && initialDraft === null,
  });

  useEffect(() => {
    if (shownDraft) {
      settleShown(shownDraft);
    }
  }, [shownDraft]);

  const submit = useSubmitGoal({
    material,
    onAsk: () => setState({ kind: "questions" }),
    understand: (goal, sent) => void submission.send(goal, sent),
  });

  /** The draft holds the material it was sent with, so editing brings it back after a reload too. */
  const editDraft = (draft: OnboardingDraftView) => {
    material.restore(draft);
    showEntry({ words: draft.prompt });
  };

  const atGoalLimit = goalLimit?.reason === "activeGoals";
  const onBack = getBack({ editDraft, showEntry, state });
  const bar = { backDisabled: creation.isCreating, onBack };

  const rail = showsRail({ atGoalLimit, state }) ? (
    <>
      {state.kind === "entry" && <SectionExamples onPick={submit} />}
      <OnboardingHowItWorks hasAccount={canAttach} />
    </>
  ) : null;

  return (
    <OnboardingRailProvider rail={rail}>
      <OnboardingFrame bar={bar}>
        {state.kind === "entry" && (
          <GoalStartEntry
            atGoalLimit={atGoalLimit}
            attach={actions.attach}
            attached={material.attached}
            canAttach={canAttach}
            defaultGoal={state.words}
            error={state.error}
            fromSharedPlan={fromSharedPlan}
            intent={material.intent}
            onAttachedChange={material.setAttached}
            onIntentChange={material.setIntent}
            onSubmit={submit}
            routes={routes}
          />
        )}

        {state.kind === "questions" && (
          <MaterialQuestions ask={actions.askMaterial} buddy={buddy} sources={material.attached} />
        )}

        {state.kind === "sending" && (
          <SendingGoal attemptId={state.attemptId} goal={state.goal} since={state.sentAt} />
        )}

        {state.kind === "draft" && (
          <DraftScreen
            actions={actions}
            creation={{
              error: creation.error,
              isCreating: creation.isCreating || submission.isSubmitting,
              run: (run) =>
                creation.create({
                  onCreated: navigation.toSteps,
                  onLimit: () => void draftActions.loadRead(),
                  run,
                }),
              startExplanation,
            }}
            draft={state.draft}
            draftActions={draftActions}
            goalLimit={goalLimit}
            hasAccount={canAttach}
            onBack={() => editDraft(state.draft)}
            onRewrite={(goal) => void submission.send(goal, toDraftMaterial(state.draft))}
            routes={routes}
            sentAt={state.sentAt}
          />
        )}
      </OnboardingFrame>
    </OnboardingRailProvider>
  );
}
