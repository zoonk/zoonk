"use client";

import { createContext, use } from "react";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { type MomentCeremony } from "../moment-ceremony";
import { type StudySessionSummary } from "../session-types";

/** Each returns false when it didn't work. */
export type SessionSummaryActions = {
  /** Re-reads a stale summary without preparing or starting more content. */
  refresh: () => void;
  addExtraTime: () => Promise<boolean>;
  keepGoing: () => Promise<boolean>;
};

export type SummaryGoalKind = "exam" | "explain" | "language" | "learn";

type SessionSummaryValue = {
  actions: SessionSummaryActions;
  buddy: LearnBuddy | null;
  ceremony?: MomentCeremony;
  exitHref: string;
  goalKind: SummaryGoalKind;
  mistakesHref: string | null;
  signUpHref: string | null;
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
 * From the host: an unfinished session alone doesn't mean stopped, since "10 more minutes" adds a
 * block too.
 */
export function useIsStopped(): boolean {
  return useSessionSummary().stopped;
}
