"use client";

import { type OnboardingStep } from "@zoonk/core/view-models/onboarding/contract";
import { type ReactNode, createContext, use, useEffect, useMemo, useRef } from "react";
import { type GenerationRun } from "../generation/generation-run";
import { useVisibleWait } from "../generation/use-visible-wait";
import { useLearnAnalytics } from "../learn-context";

type GoalClock = { goalId: string; onboardingId?: string };
const ClockContext = createContext<GoalClock | null>(null);

export function useOnboardingClock() {
  return use(ClockContext);
}

export function useOnboardingWait(surface: string, enabled = true): void {
  const clock = useOnboardingClock();
  const { track } = useLearnAnalytics();
  useVisibleWait({ ...clock, contentKind: "curriculum", enabled, surface, track });
}

export function OnboardingClock({
  children,
  goalId,
  onboardingId,
  run,
  step,
}: GoalClock & { children: ReactNode; run: GenerationRun | null; step: OnboardingStep }) {
  const { track } = useLearnAnalytics();
  const received = useRef<string | null>(null);
  const value = useMemo(() => ({ goalId, onboardingId }), [goalId, onboardingId]);
  const deckId = run?.warmUpId;

  useEffect(() => {
    if (deckId && received.current !== deckId) {
      received.current = deckId;

      track({
        name: "Onboarding Progressed",
        properties: {
          at: Date.now(),
          deck_id: deckId,
          goal_id: goalId,
          onboarding_id: onboardingId,
          stage: "deck_received",
        },
      });
    }
  }, [deckId, goalId, onboardingId, track]);

  return (
    <ClockContext value={value}>
      {step !== "plan" && step !== "schedule" && <OnboardingQuestionShown step={step} />}
      {children}
    </ClockContext>
  );
}

export function OnboardingQuestionShown({ step }: { step: OnboardingStep }) {
  const clock = useOnboardingClock();
  const { track } = useLearnAnalytics();

  const shown = useRef<string | null>(null);

  useEffect(() => {
    const key = `${clock?.goalId}:${step}`;

    const show = () => {
      if (clock && document.visibilityState === "visible" && shown.current !== key) {
        shown.current = key;

        track({
          name: "Onboarding Progressed",
          properties: {
            at: Date.now(),
            goal_id: clock.goalId,
            onboarding_id: clock.onboardingId,
            question: step,
            stage: "question_shown",
          },
        });
      }
    };

    show();
    document.addEventListener("visibilitychange", show);
    return () => document.removeEventListener("visibilitychange", show);
  }, [clock, step, track]);

  return null;
}
