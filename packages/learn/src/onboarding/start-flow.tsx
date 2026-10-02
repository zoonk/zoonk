"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useLocale } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { type ExperienceMode } from "../experience-mode";
import { useLearnAnalytics } from "../learn-context";
import { ModeProvider } from "../mode-provider";
import { getClassifiedKind, useDraftGoals } from "./entry/draft-goals";
import { DraftScreen } from "./entry/draft-screen";
import { AttachableGoalEntry } from "./entry/goal-attachments";
import { useSubmitGoal } from "./entry/material-goal";
import { type MaterialIntent } from "./entry/material-intent";
import { MaterialQuestions } from "./entry/material-questions";
import { sendGoal, takeGoalSent } from "./entry/understanding-start";
import { SendingGoal } from "./entry/understanding-wait";
import { useDraftActions } from "./entry/use-draft-actions";
import { useGoalCreation } from "./entry/use-goal-creation";
import { type GoalError, useStartError } from "./goal-errors";
import {
  type AttachedSource,
  type OnboardingActions,
  type OnboardingNavigation,
  type OnboardingRoutes,
} from "./onboarding-actions";
import { OnboardingFrame, OnboardingTopBar } from "./onboarding-frame";

type StartState =
  | { error: GoalError | null; kind: "entry"; words: string }
  | { kind: "questions" }
  | { goal: string; kind: "sending" }
  | { draft: OnboardingDraftView; kind: "draft" };

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
 * creates the goals and continues on the goal's own onboarding screens.
 */
export function StartFlow({
  actions,
  canAttach = false,
  defaultGoal = "",
  fromSharedPlan = false,
  initialDraft = null,
  initialMode,
  navigation,
  routes,
}: {
  actions: OnboardingActions;
  /** An account can attach material; guests and visitors are asked to create one. */
  canAttach?: boolean;
  defaultGoal?: string;
  /** Opened from someone's plan link: the goal starts from that plan. */
  fromSharedPlan?: boolean;
  /** The draft in the address, to show again after a refresh or when coming back. */
  initialDraft?: OnboardingDraftView | null;
  initialMode: ExperienceMode;
  navigation: OnboardingNavigation;
  routes: OnboardingRoutes;
}) {
  const locale = useLocale();
  const analytics = useLearnAnalytics();
  const creation = useGoalCreation();
  const getStartError = useStartError();
  const { createExplanation } = useDraftGoals(actions);
  const [attached, setAttached] = useState<AttachedSource[]>([]);
  const [intent, setIntent] = useState<MaterialIntent | null>(null);

  const [state, setState] = useState<StartState>(() =>
    initialDraft
      ? { draft: initialDraft, kind: "draft" }
      : { error: null, kind: "entry", words: defaultGoal },
  );

  const showDraft = (draft: OnboardingDraftView) => {
    navigation.showDraft(draft.id);
    setState({ draft, kind: "draft" });
  };

  const draftActions = useDraftActions({
    draft: state.kind === "draft" ? state.draft : null,
    onDraft: showDraft,
    understanding: actions.understanding,
  });

  const showEntry = ({ error = null, words }: { error?: GoalError | null; words: string }) => {
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

  /**
   * A draft that was just read: "Goal Classified" counts how long it took from the learner's tap,
   * and a question goes on to its explanation. Both only follow a tap in this tab (`takeGoalSent`
   * finds it once), never a refresh or a link, since the explanation is new work.
   */
  const settle = useEffectEvent((draft: OnboardingDraftView) => {
    const understanding = draft.status === "understood" ? draft.understanding : null;
    const sentAt = understanding ? takeGoalSent(draft.id) : null;

    if (!understanding || sentAt === null) {
      return;
    }

    analytics.track({
      name: "Goal Classified",
      properties: {
        duration_ms: Math.max(0, Date.now() - sentAt),
        result: getClassifiedKind(understanding),
      },
    });

    if (understanding.status === "explain") {
      startExplanation({ draft, question: understanding.question });
    }
  });

  useEffect(() => {
    if (state.kind === "draft") {
      settle(state.draft);
    }
  }, [state]);

  const understand = (goal: string) => {
    analytics.track({ name: "Goal Typed", properties: { has_attachment: attached.length > 0 } });
    setState({ goal, kind: "sending" });

    void (async () => {
      const outcome = await sendGoal({
        goal,
        language: locale,
        understanding: actions.understanding,
      });

      if (outcome.status === "started" || outcome.status === "startFailed") {
        showDraft(outcome.draft);
        return;
      }

      showEntry({ error: getStartError(outcome), words: goal });
    })();
  };

  const submit = useSubmitGoal({
    attached,
    intent,
    onAsk: () => setState({ kind: "questions" }),
    understand,
  });

  const backToEntry = (words: string) => showEntry({ words });

  return (
    <ModeProvider experienceMode={initialMode}>
      <OnboardingFrame>
        <OnboardingTopBar onBack={getBack({ backToEntry, state })} />

        {state.kind === "entry" && (
          <AttachableGoalEntry
            attach={actions.attach}
            attached={attached}
            canAttach={canAttach}
            defaultGoal={state.words}
            error={state.error}
            fromSharedPlan={fromSharedPlan}
            intent={intent}
            onAttachedChange={setAttached}
            onIntentChange={setIntent}
            onSubmit={submit}
            routes={routes}
          />
        )}

        {state.kind === "questions" && (
          <MaterialQuestions ask={actions.askMaterial} sources={attached} />
        )}

        {state.kind === "sending" && <SendingGoal goal={state.goal} />}

        {state.kind === "draft" && (
          <DraftScreen
            actions={actions}
            attached={attached}
            creation={{
              error: creation.error,
              isCreating: creation.isCreating,
              run: (run) => creation.create({ onCreated: navigation.toSteps, run }),
              startExplanation,
            }}
            draft={state.draft}
            draftActions={draftActions}
            intent={intent}
            onBack={() => backToEntry(state.draft.prompt)}
            onRewrite={understand}
            routes={routes}
          />
        )}
      </OnboardingFrame>
    </ModeProvider>
  );
}
