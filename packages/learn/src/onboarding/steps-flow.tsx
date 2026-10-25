"use client";

import {
  type OnboardingAnswerInput,
  type OnboardingStep,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useRef, useState, useTransition } from "react";
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

/** The screens that count as steps in the dots, in the names the goal saves its answers under. */
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
  // Placement sits between the questions, so it's a step like them; the plan isn't.
  "placement",
]);

function isStepScreen(step: unknown): step is OnboardingStep {
  return typeof step === "string" && STEP_SCREENS.has(step);
}

/**
 * The steps this goal's onboarding already went through, in the order they were answered, so after
 * a refresh the dots count them and Back returns to them, as it does before one.
 */
function getAnsweredScreens(view: OnboardingView): OnboardingStep[] {
  const answered = view.goal.details.answered;
  return Array.isArray(answered) ? answered.filter((step) => isStepScreen(step)) : [];
}

function countSteps(steps: OnboardingStep[]): number {
  return steps.filter((step) => isStepScreen(step)).length;
}

/**
 * The rest of onboarding for a new goal, at `/start/[goalId]`: only the questions its words
 * didn't answer, one per screen with Back and a "⋯" to finish later or start over, then the buddy
 * when the profile needs one, placement while the first lessons are made, and the plan. A refresh
 * comes back to the same screen, since each answer is saved. When the run building the plan in the
 * background couldn't start or failed, the questions say so with a way to start it again.
 */
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
  /** The run writing the goal's skill map, placement questions and plan, when the host follows it. */
  generation?: GenerationRun | null;
  initialPlan: RevealedPlan | null;
  isGuest: boolean;
  navigation: OnboardingNavigation;
  onboarding: OnboardingView;
  planActions: PlanActions;
  routes: OnboardingRoutes;
}) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  // The page read the plan when it opened: current only when it opened on the plan. After the
  // steps (placement, the learner's time), the reveal reads it fresh instead of showing that one.
  const pagePlan = (onboarding.steps[0] ?? "plan") === "plan" ? initialPlan : null;

  const [state, setState] = useState<FlowState>(() => ({
    current: onboarding.steps[0] ?? "plan",
    history: getAnsweredScreens(onboarding),
    view: onboarding,
  }));

  // One answer saves at a time, admitted at once: a pick that moves on by itself and Continue (or
  // a second pick) while it saves never save twice and skip the question after it.
  const saving = useRef(false);

  // The screen whose answer (or start over) is saving, and whether its request is still open.
  // While it is, every screen waits (Back included: a pick there couldn't save). Once it answers,
  // the transition stays pending until the page's refresh after the save lands, seconds on a cold
  // server, while the next screen already shows: then only the screen that sent it waits, so the
  // next one answers at once (an ENEM learner's "1" for English did nothing there).
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
      // picked: the error page's "Try again" started an IELTS learner's time question over.
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

  // In the page's aside from 72rem, the plan so far: what the answers set, as they set it.
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
            // The plan is built from the answers: changing them now happens in "Adjust", not by
            // going back through the questions.
            onBack: state.history.length > 0 && !isPlan ? back : undefined,
          }}
          notice={
            failed && (
              <p className="text-destructive-text text-sm" role="alert">
                {t("We couldn't save that. Try again in a moment.")}
              </p>
            )
          }
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
