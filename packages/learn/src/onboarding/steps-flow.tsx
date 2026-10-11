"use client";

import {
  type OnboardingAnswerInput,
  type OnboardingStep,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type GenerationRun } from "../generation/generation-run";
import { type PlanActions } from "../plan/plan-context";
import {
  type OnboardingActions,
  type OnboardingNavigation,
  type OnboardingRoutes,
  type RevealedPlan,
} from "./onboarding-actions";
import {
  OnboardingProgressProvider,
  OnboardingTaskFrame,
  OnboardingTopBar,
} from "./onboarding-frame";
import { OnboardingStepScreen } from "./onboarding-step-screen";
import { StartOverButton } from "./start-over-button";
import { PlanStartNotice } from "./steps/plan-start-notice";

/** Placement and the plan aren't questions, so they don't count in the dots. */
const UNCOUNTED_STEPS = new Set<OnboardingStep>(["placement", "plan"]);

/** The screens that count as questions, in the names the goal saves its answers under. */
const QUESTION_SCREENS = new Set<string>([
  "purpose",
  "role",
  "reason",
  "target",
  "targetDate",
  "followUps",
  "level",
  "schedule",
  "buddy",
]);

function isQuestionScreen(step: unknown): step is OnboardingStep {
  return typeof step === "string" && QUESTION_SCREENS.has(step);
}

/**
 * The questions this goal's onboarding already asked, in the order they were answered, so after a
 * refresh the dots count them and Back returns to them.
 */
function getAnsweredScreens(view: OnboardingView): OnboardingStep[] {
  const answered = view.goal.details.answered;
  return Array.isArray(answered) ? answered.filter((step) => isQuestionScreen(step)) : [];
}

type FlowState = { current: OnboardingStep; history: OnboardingStep[]; view: OnboardingView };

function countQuestions(steps: OnboardingStep[]): number {
  return steps.filter((step) => !UNCOUNTED_STEPS.has(step)).length;
}

/**
 * The rest of onboarding for a new goal, at `/start/[goalId]`: only the questions its words
 * didn't answer, one per screen with Back and Start over, then the buddy when the profile needs
 * one, placement while the first lessons are made, and the plan. A refresh comes
 * back to the same screen, since each answer is saved. When the run building the plan in the
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

  const advance = (view: OnboardingView) =>
    setState((previous) => ({
      ...previous,
      current: view.steps.find((step) => step !== previous.current) ?? "plan",
      history: [...previous.history, previous.current],
      view,
    }));

  const answer = (input: OnboardingAnswerInput) =>
    startTransition(async () => {
      setFailed(false);

      // A save that fails, even by throwing, keeps the learner on this screen with what they
      // picked: the error page's "Try again" started an IELTS learner's time question over.
      const { data: outcome } = await safeAsync(() =>
        actions.answer({ goalId: state.view.goal.id, input }),
      );

      if (!outcome || outcome.status === "failed") {
        setFailed(true);
        return;
      }

      // "Pass an exam" moved a language goal to an exam goal: the steps go on at the new goal's page.
      if (outcome.onboarding.goal.id !== state.view.goal.id) {
        navigation.replaceSteps(outcome.onboarding.goal.id);
      }

      advance(outcome.onboarding);
    });

  const back = () =>
    setState((previous) => ({
      ...previous,
      current: previous.history.at(-1) ?? previous.current,
      history: previous.history.slice(0, -1),
    }));

  const startOver = () =>
    startTransition(async () => {
      await actions.startOver(state.view.goalIds);
      navigation.toStart();
    });

  const isPlan = state.current === "plan";
  const remaining = countQuestions(state.view.steps.filter((step) => step !== state.current));
  const answeredCount = countQuestions(state.history);
  const showDots = !UNCOUNTED_STEPS.has(state.current);

  const progress = showDots
    ? { current: answeredCount, total: answeredCount + 1 + remaining }
    : null;

  return (
    <OnboardingTaskFrame>
      <OnboardingTopBar
        end={isPlan ? null : <StartOverButton disabled={isPending} onStartOver={startOver} />}
        // The plan is built from the answers: changing them now happens in "Adjust", not by going
        // back through the questions.
        onBack={state.history.length > 0 && !isPlan ? back : undefined}
        progress={progress}
      />

      {failed && (
        <p className="text-destructive mx-auto w-full max-w-xl px-4 text-sm" role="alert">
          {t("We couldn't save that. Try again in a moment.")}
        </p>
      )}

      {showDots && generation && <PlanStartNotice run={generation} />}

      <OnboardingProgressProvider progress={progress}>
        <OnboardingStepScreen
          actions={actions}
          isGuest={isGuest}
          onAnswer={answer}
          onPlacementDone={() => answer({ question: "placement" })}
          pending={isPending}
          plan={{ initialPlan: pagePlan, planActions }}
          routes={routes}
          run={generation}
          step={state.current}
          view={state.view}
        />
      </OnboardingProgressProvider>
    </OnboardingTaskFrame>
  );
}
