"use client";

import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { type PlanChangeDecisionInput, type PlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { createContext, use } from "react";
import { type TestOutStart } from "../_components/test-out-start-link";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type MissionLinks } from "../missions/mission-links";
import { type MissionsDay } from "../missions/missions-card";
import { type DayStep } from "../session/session-types";

/**
 * `continueSession` resolves to false when it didn't work; every other action to whether it was
 * saved, or what it saved.
 */
export type TodayActions = {
  addExtraTime: () => Promise<boolean>;
  answerInsight: (input: {
    insightId: string;
    status: "accepted" | "dismissed";
  }) => Promise<boolean>;
  answerSuggestedGoal: (input: {
    status: "accepted" | "dismissed";
    suggestion: SuggestedGoalView;
  }) => Promise<boolean>;
  buddyHref: string;
  catchUp: () => Promise<boolean>;
  challengeHref: (planItemId: string) => string;
  changePlan: (operations: PlanOperation[]) => Promise<PlanChangeView | null>;
  chooseExamOption: (input: { group: string; subject: string }) => Promise<PlanChangeView | null>;
  adjustTimeHref: string;
  chooseFocusHref: string;
  studyEverythingHref: string;
  /**
   * A link for a step whose page opens it without writing (a language call); null for every other
   * step, and while opening the day would update it.
   */
  continueHref: string | null;
  continueSession: () => Promise<boolean>;
  /**
   * Resolves to the change as it stands after the answer, `stale` when it was out of date (Today
   * reads itself again), or null when it wasn't saved.
   */
  decidePlanChange: (input: {
    changeId: NonNullable<TodayView["planChange"]>["id"];
    status: PlanChangeDecisionInput["status"];
  }) => Promise<PlanChangeView | "stale" | null>;
  missionLinks: MissionLinks;
  openBlock: (step: DayStep) => Promise<boolean>;
  mistakesHref: string;
  refresh: () => unknown;
  startTestOut: (chapterId: string) => Promise<TestOutStart>;
  examHref: string;
  plusHref: string;
  summaryHref: string;
};

/** Today shows one notice at most (`pickTodayNotice`), so the host passes every one it has. */
export type TodayHostNotices = {
  practice: React.ReactNode | null;
  sourceChange: React.ReactNode | null;
  uploadRequest: React.ReactNode | null;
};

export const NO_TODAY_HOST_NOTICES: TodayHostNotices = {
  practice: null,
  sourceChange: null,
  uploadRequest: null,
};

type TodayScreenValue = {
  actions: TodayActions;
  brainPower: number | null;
  buddy: LearnBuddy | null;
  missions: MissionsDay | null;
  notices: TodayHostNotices;
  planEnd: string | null;
  today: TodayView;
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
