"use client";

import { createContext, use } from "react";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { type StudySessionSummary } from "../session-types";

/**
 * What the end of the session can do besides going back to Today (a link to `exitHref`): take "10
 * more minutes" (the host adds the block and opens it), or, right after stopping for today, keep
 * going with the next block. Each returns false when it didn't work.
 */
export type SessionSummaryActions = {
  /** Re-reads a stale summary without preparing or starting more content. */
  refresh: () => void;
  addExtraTime: () => Promise<boolean>;
  keepGoing: () => Promise<boolean>;
};

/**
 * At most one milestone per session, as the host's full-screen ceremony over the summary as it
 * opens. It calls `onClose` when the learner closes it.
 */
export type CeremonyRenderer = (
  milestone: NonNullable<StudySessionSummary["ceremony"]>,
  onClose: () => void,
) => React.ReactNode;

/** How the goal's progress is said: preparation for an exam, the way done for the rest. */
export type SummaryGoalKind = "exam" | "explain" | "language" | "learn";

type SessionSummaryValue = {
  actions: SessionSummaryActions;
  /** The learner's buddy, glad about the day's rewards; null resolves to the default buddy. */
  buddy: LearnBuddy | null;
  ceremony?: CeremonyRenderer;
  /** Where closing the summary goes. */
  exitHref: string;
  goalKind: SummaryGoalKind;
  /** The mistakes notebook, for "See mistakes" when the session saved any; null hides it. */
  mistakesHref: string | null;
  /** Where a guest creates an account to keep their plan; null for learners who have one. */
  signUpHref: string | null;
  /** The learner just tapped "Stop for today": what's done so far, the rest waiting on Today. */
  stopped: boolean;
  summary: StudySessionSummary;
};

const SessionSummaryContext = createContext<SessionSummaryValue | null>(null);

export function SessionSummaryProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: SessionSummaryValue;
}) {
  return <SessionSummaryContext value={value}>{children}</SessionSummaryContext>;
}

export function useSessionSummary(): SessionSummaryValue {
  const value = use(SessionSummaryContext);

  if (!value) {
    throw new Error("Summary components must be used within SessionSummary");
  }

  return value;
}

/**
 * A summary right after "Stop for today", as the host says: the rest of the session waits on
 * Today. An unfinished session alone doesn't say so, since "10 more minutes" adds a block too.
 */
export function useIsStopped(): boolean {
  return useSessionSummary().stopped;
}
