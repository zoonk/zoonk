"use client";

import { createContext, use } from "react";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { type StudySessionSummary } from "../session-types";

/**
 * What the end of the session can do: go back to Today, or take "10 more minutes" (the host adds
 * the block and opens it; false when that didn't work).
 */
export type SessionSummaryActions = {
  addExtraTime: () => Promise<boolean>;
  done: () => Promise<boolean>;
};

/**
 * At most one milestone screen per session. The host passes the ceremony screen when it has one
 * (Fun's belt, buddy stage or glasses ceremony); without it, the milestone lands as a quiet line.
 */
export type CeremonyRenderer = (
  milestone: NonNullable<StudySessionSummary["ceremony"]>,
) => React.ReactNode;

type SessionSummaryValue = {
  actions: SessionSummaryActions;
  ceremony?: CeremonyRenderer;
  buddy: LearnBuddy | null;
  /** Where a guest creates an account to keep their plan; null for learners who have one. */
  signUpHref: string | null;
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
