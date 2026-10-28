"use client";

import {
  type OnboardingAnswerInput,
  type OnboardingStep,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useRef, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { StepDots } from "../_components/step-dots";
import { type GenerationRun } from "../generation/generation-run";
import { type PlanActions } from "../plan/plan-context";
import { type FlowState, applyAnswer } from "./_utils/answered-step";
import {
  type OnboardingActions,
  type OnboardingNavigation,
  type OnboardingRoutes,
  type RevealedPlan,
} from "./onboarding-actions";
import { OnboardingAnnouncer } from "./onboarding-announcer";
import { BAR_MIDDLE_CLASS } from "./onboarding-bar";
import { OnboardingFrame } from "./onboarding-frame";
import { OnboardingRailProvider } from "./onboarding-rail";
import { OnboardingStepScreen } from "./onboarding-step-screen";
import { PlanReceipt } from "./plan-receipt";
import { StartOverMenu } from "./start-over-menu";
import { PlanStartNoticeProvider } from "./steps/plan-start-notice";

const STEP_SCREENS = new Set<string>([
  "purpose",
  "role",
  "reason",
  "target",
  "targetDate",
  "followUps",
  "examChoice",
  "level",
  "schedule",
  "buddy",
  "placement",
]);

function isStepScreen(step: unknown): step is OnboardingStep {
  return typeof step === "string" && STEP_SCREENS.has(step);
}

function getAnsweredScreens(view: OnboardingView): OnboardingStep[] {
  const answered = view.goal.details.answered;
  return Array.isArray(answered) ? answered.filter((step) => isStepScreen(step)) : [];
}

function countSteps(steps: OnboardingStep[]): number {
  return steps.filter((step) => isStepScreen(step)).length;
}

export function StepsFlow({
  actions,
  generation = null,
  initialPlan,
  isGuest,
  navigation,
  onboarding,
  planActions,
  routes,
}: {
  actions: OnboardingActions;
  generation?: GenerationRun | null;
  initialPlan: RevealedPlan | null;
  isGuest: boolean;
  navigation: OnboardingNavigation;
  onboarding: OnboardingView;
  planActions: PlanActions;
  routes: OnboardingRoutes;
}) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  // The page's plan is current only when it opened on the plan; after the steps, the reveal reads
  // it fresh.
  const pagePlan = (onboarding.steps[0] ?? "plan") === "plan" ? initialPlan : null;

  const [state, setState] = useState<FlowState>(() => ({
    current: onboarding.steps[0] ?? "plan",
    history: getAnsweredScreens(onboarding),
    view: onboarding,
  }));

  // One answer saves at a time, so a pick that moves on by itself and a Continue never save twice.
  const saving = useRef(false);

  // While the request is open every screen waits; once it answers, only the screen that sent it
  // waits for the refresh, so the next one answers at once.
  const [sending, setSending] = useState<{ open: boolean; step: OnboardingStep } | null>(null);

  const answer = (input: OnboardingAnswerInput) => {
    if (saving.current) {
      return;
    }

    saving.current = true;
    const step = state.current;
    setSending({ open: true, step });

    startTransition(async () => {
      setFailed(false);

      // A save that fails, even by throwing, keeps the learner on this screen with what they
      // picked.
      const { data: outcome } = await safeAsync(() =>
        actions.answer({ goalId: state.view.goal.id, input }),
      );

      saving.current = false;
      setSending({ open: false, step });

      if (!outcome || outcome.status === "failed") {
        setFailed(true);
        return;
      }

      // "Pass an exam" moved a language goal to an exam goal: the steps go on at the new goal's page.
      if (outcome.onboarding.goal.id !== state.view.goal.id) {
        navigation.replaceSteps(outcome.onboarding.goal.id);
      }

      setState((previous) => applyAnswer({ state: previous, step, view: outcome.onboarding }));
    });
  };

  const back = () =>
    setState((previous) => ({
      ...previous,
      current: previous.history.at(-1) ?? previous.current,
      history: previous.history.slice(0, -1),
    }));

  const startOver = () => {
    setSending({ open: true, step: state.current });

    startTransition(async () => {
      await actions.startOver(state.view.goalIds);
      navigation.toStart();
    });
  };

  const isPlan = state.current === "plan";
  const remaining = countSteps(state.view.steps.filter((step) => step !== state.current));
  const answeredCount = countSteps(state.history);
  const showDots = isStepScreen(state.current);

  const progress = showDots
    ? { current: answeredCount, total: answeredCount + 1 + remaining }
    : null;

  return (
    <OnboardingRailProvider rail={<PlanReceipt goal={state.view.goal} />}>
      <OnboardingAnnouncer>
        <OnboardingFrame
          bar={{
            end: isPlan ? null : <StartOverMenu disabled={isPending} onStartOver={startOver} />,
            middle: progress && (
              <StepDots
                className={BAR_MIDDLE_CLASS}
                current={progress.current}
                total={progress.total}
              />
            ),
            // Changing the answers now happens in "Adjust", not by going back through the
            // questions.
            onBack: state.history.length > 0 && !isPlan ? back : undefined,
          }}
          notice={failed && <ChangeSaveError />}
        >
          {/* Placement follows the run itself, so only the questions say it stopped. */}
          <PlanStartNoticeProvider
            run={showDots && state.current !== "placement" ? generation : null}
          >
            <OnboardingStepScreen
              actions={actions}
              isGuest={isGuest}
              onAnswer={answer}
              onPlacementDone={() => answer({ question: "placement" })}
              pending={
                isPending && sending !== null && (sending.open || sending.step === state.current)
              }
              plan={{ initialPlan: pagePlan, planActions }}
              routes={routes}
              run={generation}
              step={state.current}
              view={state.view}
            />
          </PlanStartNoticeProvider>
        </OnboardingFrame>
      </OnboardingAnnouncer>
    </OnboardingRailProvider>
  );
}
