"use client";

import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { createContext, use } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";

/**
 * How Today acts, supplied by the host. `continueSession` starts the next block and opens it
 * (the host knows the routes); it resolves to false when that didn't work, so the screen can say
 * so. Every other action resolves to whether it was saved.
 */
export type TodayActions = {
  addExtraTime: () => Promise<boolean>;
  answerInsight: (input: {
    insightId: string;
    status: "accepted" | "dismissed";
  }) => Promise<boolean>;
  /** Records the answer to a suggested goal; accepting then opens onboarding with its title. */
  answerSuggestedGoal: (input: {
    status: "accepted" | "dismissed";
    suggestion: SuggestedGoalView;
  }) => Promise<boolean>;
  continueSession: () => Promise<boolean>;
  /** Reads Today again, so a stop whose lesson is being written updates once it's written. */
  refresh: () => void;
  /** Where an exam goal's screen is (exam map, mocks, "How did it go?"); none for other hosts. */
  examHref?: string;
  /** Where "See Plus" goes when a free exam plan's first week is over. */
  plusHref: string;
  /** Where "See what changed" goes once the day's blocks are done. */
  summaryHref: string;
};

type TodayScreenValue = {
  actions: TodayActions;
  /** Fun draws the buddy; null for learners who haven't picked one. */
  buddy: LearnBuddy | null;
  today: TodayView;
  /**
   * Today was read again for so long while a lesson was being written that its run looks stuck:
   * stops stop saying it's on its way (opening it asks for it again).
   */
  writingStalled: boolean;
};

const TodayScreenContext = createContext<TodayScreenValue | null>(null);

export function TodayScreenProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: TodayScreenValue;
}) {
  return <TodayScreenContext value={value}>{children}</TodayScreenContext>;
}

export function useTodayScreen(): TodayScreenValue {
  const value = use(TodayScreenContext);

  if (!value) {
    throw new Error("Today components must be used within TodayScreen");
  }

  return value;
}
