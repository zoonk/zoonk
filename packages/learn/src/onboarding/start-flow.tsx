"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { isFocusLost } from "../_utils/is-focus-lost";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useDraftGoals } from "./entry/draft-goals";
import { DraftScreen } from "./entry/draft-screen";
import { AttachableGoalEntry } from "./entry/goal-attachments";
import { GoalExamples } from "./entry/goal-examples";
import { GoalLimitNotice } from "./entry/goal-limit-notice";
import { GuestGoalGate } from "./entry/guest-goal-gate";
import { useSubmitGoal } from "./entry/material-goal";
import { type MaterialIntent } from "./entry/material-intent";
import { MaterialQuestions } from "./entry/material-questions";
import { SendingGoal } from "./entry/understanding-wait";
import { useDraftActions } from "./entry/use-draft-actions";
import { useFollowSavedDraft } from "./entry/use-follow-saved-draft";
import { useGoalCreation } from "./entry/use-goal-creation";
import { useSubmitUnderstanding } from "./entry/use-submit-understanding";
import { type GoalError } from "./goal-errors";
import { OnboardingHowItWorks } from "./how-it-works";
import {
  type AttachedSource,
  type GoalLimitReason,
  type OnboardingActions,
  type OnboardingNavigation,
  type OnboardingRoutes,
} from "./onboarding-actions";
import { OnboardingFrame } from "./onboarding-frame";
import { useOnboardingSection } from "./onboarding-host";
import { OnboardingRailProvider } from "./onboarding-rail";

type StartState =
  | { error: GoalError | null; kind: "entry"; words: string }
  | { kind: "questions" }
  | { goal: string; kind: "sending" }
  | { draft: OnboardingDraftView; kind: "draft" };

function getScreenKey(state: StartState): string {
  if (state.kind === "draft") {
    return state.draft.status === "understood" ? `${state.draft.id}:read` : "wait";
  }

  return state.kind;
}

function getBack({
  backToEntry,
  state,
}: {
  backToEntry: (words: string) => void;
  state: StartState;
}): (() => void) | undefined {
  if (state.kind === "questions") {
    return () => backToEntry("");
  }

  return state.kind === "draft" ? () => backToEntry(state.draft.prompt) : undefined;
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

type GoalStartFlowProps = {
  actions: OnboardingActions;
  /** `null` is the resolved default buddy; `undefined` isn't known yet. */
  buddy?: LearnBuddy | null;
  canAttach?: boolean;
  defaultGoal?: string;
  fromSharedPlan?: boolean;
  goalLimit?: GoalLimitReason | null;
  initialDraft?: OnboardingDraftView | null;
  navigation: OnboardingNavigation;
  routes: OnboardingRoutes;
};

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
}: GoalStartFlowProps) {
  const section = useOnboardingSection();
  const creation = useGoalCreation();
  const { createExplanation } = useDraftGoals(actions);
  const [attached, setAttached] = useState<AttachedSource[]>([]);
  const [intent, setIntent] = useState<MaterialIntent | null>(null);

  const [state, setState] = useState<StartState>(() =>
    initialDraft
      ? { draft: initialDraft, kind: "draft" }
      : { error: null, kind: "entry", words: defaultGoal },
  );

  const screen = getScreenKey(state);
  const lastFocusedScreen = useRef(screen);

  useLayoutEffect(() => {
    if (lastFocusedScreen.current === screen) {
      return;
    }

    lastFocusedScreen.current = screen;

    if (!isFocusLost(document.activeElement)) {
      return;
    }

    const title = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="onboarding-title"]'),
    ].find((heading) => heading.checkVisibility());

    title?.focus({ preventScroll: true });
  }, [screen]);

  const savedDraft = useFollowSavedDraft({
    follow: (draft) => setState({ draft, kind: "draft" }),
    initialDraft,
    shown: state.kind === "draft" ? state.draft : null,
  });

  const showDraft = (draft: OnboardingDraftView) => {
    navigation.showDraft(draft.id);
    savedDraft.markOwn();
    setState({ draft, kind: "draft" });
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
    hasAttachment: attached.length > 0,
    onDraft: showDraft,
    onError: showEntry,
    onExplanation: startExplanation,
    onSending: (goal) => {
      draftActions.cancel();
      setState({ goal, kind: "sending" });
    },
    understanding: actions.understanding,
  });

  const shownDraft = state.kind === "draft" ? state.draft : null;
  const settleShown = useEffectEvent((draft: OnboardingDraftView) => submission.settle(draft));

  useEffect(() => {
    if (shownDraft) {
      settleShown(shownDraft);
    }
  }, [shownDraft]);

  const submit = useSubmitGoal({
    attached,
    intent,
    onAsk: () => setState({ kind: "questions" }),
    understand: (goal) => void submission.send(goal),
  });

  const backToEntry = (words: string) => showEntry({ words });

  const rail = (
    <>
      {section && state.kind === "entry" && <GoalExamples onPick={submit} />}
      <OnboardingHowItWorks hasAccount={canAttach} />
    </>
  );

  return (
    <OnboardingRailProvider rail={rail}>
      <OnboardingFrame bar={{ onBack: getBack({ backToEntry, state }) }}>
        {state.kind === "entry" && (
          <AttachableGoalEntry
            attach={actions.attach}
            attached={attached}
            canAttach={canAttach}
            defaultGoal={state.words}
            error={state.error}
            fromSharedPlan={fromSharedPlan}
            intent={intent}
            notice={goalLimit && <GoalLimitNotice reason={goalLimit} upFront />}
            onAttachedChange={setAttached}
            onIntentChange={setIntent}
            onSubmit={submit}
            routes={routes}
          />
        )}

        {state.kind === "questions" && (
          <MaterialQuestions ask={actions.askMaterial} buddy={buddy} sources={attached} />
        )}

        {state.kind === "sending" && <SendingGoal goal={state.goal} />}

        {state.kind === "draft" && (
          <DraftScreen
            actions={actions}
            attached={attached}
            creation={{
              error: creation.error,
              isCreating: creation.isCreating || submission.isSubmitting,
              run: (run) => creation.create({ onCreated: navigation.toSteps, run }),
              startExplanation,
            }}
            draft={state.draft}
            draftActions={draftActions}
            goalLimit={goalLimit}
            intent={intent}
            onBack={() => backToEntry(state.draft.prompt)}
            onRewrite={(goal) => void submission.send(goal)}
            routes={routes}
          />
        )}
      </OnboardingFrame>
    </OnboardingRailProvider>
  );
}
