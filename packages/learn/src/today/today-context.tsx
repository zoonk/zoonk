"use client";

import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { type PlanChangeDecisionInput, type PlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { createContext, use } from "react";
import { type TestOutStart } from "../_components/test-out-start-link";
import { type LearnBuddy } from "../buddies/use-buddy-name";

/**
 * How Today acts, supplied by the host. `continueSession` starts the next block and opens it
 * (the host knows the routes); it resolves to false when that didn't work, so the screen can say
 * so. Every other action resolves to whether it was saved, or to what it saved.
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
  /** Where the buddy's tab is, which a day with nothing new offers for practice; none without one. */
  buddyHref?: string;
  /**
   * "Catch up today": the lessons earlier days left that today's time didn't fit join today's
   * session. Resolves to whether they were added (Today reads itself again to show them).
   */
  catchUp: () => Promise<boolean>;
  /** Where the week's challenge opens, before and on its day, from its plan item: its flag opens it. */
  challengeHref: (planItemId: string) => string;
  /**
   * Changes the plan as the learner chose on Today (more time a day when falling behind puts the
   * date at risk). Resolves to the change, or null when it wasn't saved.
   */
  changePlan: (operations: PlanOperation[]) => Promise<PlanChangeView | null>;
  /** Where choosing where the plan's depth goes opens (the plan's focus). */
  chooseFocusHref: string;
  continueSession: () => Promise<boolean>;
  /**
   * Answers the plan change on Today: apply or not now for a proposal, undo or "Got it" for a
   * change already made. Resolves to the change as it stands after the answer (whether today's
   * session took it), or null when it wasn't saved.
   */
  decidePlanChange: (input: {
    changeId: string;
    status: PlanChangeDecisionInput["status"];
  }) => Promise<PlanChangeView | null>;
  /** "Not now" to inviting a guardian: Today stops offering it, on every device. */
  dismissGuardianInvite: () => Promise<boolean>;
  /** Where the mistakes notebook opens, from "Practice anytime". */
  mistakesHref: string;
  /** Reads Today again, so a stop whose lesson is being written updates once it's written. */
  refresh: () => void;
  /** "Already know this?" on the next lesson: opens its chapter's test (`chapterId`). */
  startTestOut: (chapterId: string) => Promise<TestOutStart>;
  /** Where an exam goal's screen is (exam map, mocks, "How did it go?"); none for other hosts. */
  examHref?: string;
  /** Where "See Plus" goes when a free exam plan's first week is over. */
  plusHref: string;
  /** Where "See what changed" goes once the day's blocks are done. */
  summaryHref: string;
};

/**
 * Notices the host draws, since they need its actions; null when there's nothing to say. Today
 * shows one notice at most (`pickTodayNotice`), so the host passes every one it has.
 */
export type TodayHostNotices = {
  /** A language goal's practice that's due: a noticed pattern or words to say again. */
  practice: React.ReactNode | null;
  /** The newest change to a source the goal is built on, such as its exam notice. */
  sourceChange: React.ReactNode | null;
  /** A document research asked the learner for. */
  uploadRequest: React.ReactNode | null;
};

export const NO_TODAY_HOST_NOTICES: TodayHostNotices = {
  practice: null,
  sourceChange: null,
  uploadRequest: null,
};

type TodayScreenValue = {
  actions: TodayActions;
  /** The learner's buddy, who cheers a finished day; null until they pick one. */
  buddy: LearnBuddy | null;
  notices: TodayHostNotices;
  /**
   * The plan's estimated end ("YYYY-MM-DD"), the one the Journey shows, so a proposed change says
   * its new end the same way; null when the host didn't read it (a plan with a date never says it).
   */
  planEnd: string | null;
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
