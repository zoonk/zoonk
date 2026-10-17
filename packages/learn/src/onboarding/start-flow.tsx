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

/**
 * The screen by its title, as drawn: the draft's wait replaces the sending wait's title with its
 * own, so it takes the focus that one lost.
 */
function getScreenKey(state: StartState): string {
  if (state.kind === "draft") {
    return state.draft.status === "understood" ? `${state.draft.id}:read` : "wait";
  }

  return state.kind;
}

/** Back goes to writing the goal, with the words kept, from anywhere but the first screen. */
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

/**
 * The first part of onboarding, at `/start`: the typed goal, a short wait while it's read, then
 * "Here's what I understood" to confirm. The goal is kept as a draft (`/start?draft=`), so a
 * refresh or coming back later shows the same screen: the wait, the card with the learner's
 * fixes, or the way to try again. A question goes on to its quick explanation, an instrument to
 * the waitlist with musicianship offered, and an unsafe goal is declined kindly. Confirming
 * creates the goals and continues on the goal's own onboarding screens. A guest whose one goal is
 * taken is asked to create an account instead, before typing anything; a learner whose plan can't
 * start another goal (`goalLimit`) is told up front, with the box open for quick questions. Until
 * the goal is confirmed there's no plan to show in the page's aside from 72rem: how it works
 * instead.
 */
export function StartFlow({
  needsAccount = false,
  ...props
}: React.ComponentProps<typeof GoalStartFlow> & {
  /** A guest whose one goal is taken: only an account adds another. */
  needsAccount?: boolean;
}) {
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
  /** The learner's buddy; null is the resolved default, undefined is not known yet. */
  buddy?: LearnBuddy | null;
  /** An account can attach material; guests and visitors are asked to create one. */
  canAttach?: boolean;
  defaultGoal?: string;
  /** Opened from someone's plan link: the goal starts from that plan. */
  fromSharedPlan?: boolean;
  /** A goal limit the learner already reached, said before they type. */
  goalLimit?: GoalLimitReason | null;
  /** The draft in the address, to show again after a refresh or when coming back. */
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

  // A new screen takes the focus the old one lost, but the first one keeps it where the browser
  // put it.
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

  // A draft this tab's click sent, shown once its words are read (sent here or from the home page,
  // read while it showed, or already read when this page opened), carries the click on, once.
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

  // Under Today's title the examples to start from move to the page's aside, with how it works.
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
