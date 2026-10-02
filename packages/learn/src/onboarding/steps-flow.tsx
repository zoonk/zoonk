"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import {
  type OnboardingAnswerInput,
  type OnboardingStep,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type ExperienceMode } from "../experience-mode";
import { type GenerationRun } from "../generation/generation-run";
import { ModeProvider } from "../mode-provider";
import { type PlanActions } from "../plan/plan-context";
import {
  type OnboardingActions,
  type OnboardingNavigation,
  type OnboardingRoutes,
} from "./onboarding-actions";
import { OnboardingFrame, OnboardingTopBar } from "./onboarding-frame";
import { OnboardingStepScreen } from "./onboarding-step-screen";
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
  "age",
  "mode",
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

type FlowState = {
  current: OnboardingStep;
  history: OnboardingStep[];
  /** A teen just gave their age: the guardian invite comes before the next step. */
  inviting: boolean;
  tooYoung: boolean;
  view: OnboardingView;
};

function countQuestions(steps: OnboardingStep[]): number {
  return steps.filter((step) => !UNCOUNTED_STEPS.has(step)).length;
}

function useModeState(initialMode: ExperienceMode) {
  const [mode, setMode] = useState(initialMode);
  const [buddy, setBuddy] = useState<LearnBuddy | null>(null);

  const learnFrom = (input: OnboardingAnswerInput) => {
    if (input.question === "mode") {
      setMode(input.experienceMode);
    }

    if (input.question === "buddy" && input.buddy) {
      setBuddy({
        beltColor: "white",
        energy: 50,
        glasses: "round",
        kind: input.buddy.kind,
        name: input.buddy.name ?? null,
      });
    }
  };

  return { buddy, learnFrom, mode };
}

/**
 * The rest of onboarding for a new goal, at `/start/[goalId]`: only the questions its words
 * didn't answer, one per screen with Back and Start over, then the age, mode and buddy when the
 * profile needs them, placement while the first lessons are made, and the plan. Choosing Fun
 * switches the screens to Fun right away. A refresh comes back to the same screen, since each
 * answer is saved. When the run building the plan in the background couldn't start or failed,
 * the questions say so with a way to start it again.
 */
export function StepsFlow({
  actions,
  generation = null,
  initialMode,
  initialPlan,
  isGuest,
  navigation,
  onboarding,
  buddy: savedBuddy,
  planActions,
  routes,
  testOutBasePath,
}: {
  actions: OnboardingActions;
  /** The run writing the goal's skill map, placement questions and plan, when the host follows it. */
  generation?: GenerationRun | null;
  initialMode: ExperienceMode;
  initialPlan: PlanView | null;
  isGuest: boolean;
  navigation: OnboardingNavigation;
  onboarding: OnboardingView;
  buddy: LearnBuddy | null;
  planActions: PlanActions;
  routes: OnboardingRoutes;
  testOutBasePath: string;
}) {
  const t = useExtracted();
  const modeState = useModeState(initialMode);
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const [state, setState] = useState<FlowState>(() => ({
    current: onboarding.steps[0] ?? "plan",
    history: getAnsweredScreens(onboarding),
    inviting: false,
    tooYoung: false,
    view: onboarding,
  }));

  const advance = (view: OnboardingView, inviting = false) =>
    setState((previous) => ({
      ...previous,
      current: view.steps.find((step) => step !== previous.current) ?? "plan",
      history: [...previous.history, previous.current],
      inviting,
      view,
    }));

  const answer = (input: OnboardingAnswerInput) =>
    startTransition(async () => {
      setFailed(false);
      const outcome = await actions.answer({ goalId: state.view.goal.id, input });

      if (outcome.status === "accountDeleted") {
        setState((previous) => ({ ...previous, tooYoung: true }));
        return;
      }

      if (outcome.status === "failed") {
        setFailed(true);
        return;
      }

      // "Pass an exam" moved a language goal to an exam goal: the steps go on at the new goal's page.
      if (outcome.onboarding.goal.id !== state.view.goal.id) {
        navigation.replaceSteps(outcome.onboarding.goal.id);
      }

      modeState.learnFrom(input);

      advance(
        outcome.onboarding,
        // Guardians are invited from an account; a guest is asked once they sign up.
        input.question === "age" && outcome.onboarding.isMinor && !isGuest,
      );
    });

  const back = () =>
    setState((previous) => ({
      ...previous,
      current: previous.history.at(-1) ?? previous.current,
      history: previous.history.slice(0, -1),
      inviting: false,
    }));

  const startOver = () =>
    startTransition(async () => {
      await actions.startOver(state.view.goalIds);
      navigation.toStart();
    });

  const remaining = countQuestions(state.view.steps.filter((step) => step !== state.current));
  const answeredCount = countQuestions(state.history);
  const showDots = !UNCOUNTED_STEPS.has(state.current) && !state.tooYoung;

  return (
    <ModeProvider experienceMode={modeState.mode}>
      <OnboardingFrame>
        <OnboardingTopBar
          end={
            state.tooYoung || state.current === "plan" ? null : (
              <Button disabled={isPending} onClick={startOver} size="sm" variant="ghost">
                {t("Start over")}
              </Button>
            )
          }
          onBack={state.history.length > 0 && !state.tooYoung ? back : undefined}
          progress={
            showDots ? { current: answeredCount, total: answeredCount + 1 + remaining } : null
          }
        />

        {failed && (
          <p className="text-destructive mx-auto w-full max-w-xl px-4 text-sm" role="alert">
            {t("We couldn't save that. Try again in a moment.")}
          </p>
        )}

        {showDots && generation && <PlanStartNotice run={generation} />}

        <OnboardingStepScreen
          actions={actions}
          inviting={state.inviting}
          isGuest={isGuest}
          onAnswer={answer}
          onGuardianDone={() => setState((previous) => ({ ...previous, inviting: false }))}
          onPlacementDone={() => answer({ question: "placement" })}
          pending={isPending}
          buddy={modeState.buddy ?? savedBuddy}
          plan={{ initialPlan, planActions, testOutBasePath }}
          routes={routes}
          run={generation}
          step={state.current}
          tooYoung={state.tooYoung}
          view={state.view}
        />
      </OnboardingFrame>
    </ModeProvider>
  );
}
