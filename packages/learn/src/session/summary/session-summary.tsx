"use client";

import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { type StudySessionSummary } from "../session-types";
import {
  type CeremonyRenderer,
  type SessionSummaryActions,
  SessionSummaryProvider,
  type SummaryGoalKind,
} from "./summary-context";
import { SummarySteps } from "./summary-steps";

export type { SummaryGoalKind } from "./summary-context";

/**
 * The end of the session, told in steps: what changed today. Right after "Stop for today", what's
 * done so far.
 *
 * ```tsx
 * <SessionSummary actions={actions} buddy={buddy} exitHref="/today" goalKind="exam" summary={summary} />
 * ```
 */
export function SessionSummary({
  actions,
  buddy,
  exitHref,
  goalKind,
  renderCeremony,
  signUpHref = null,
  summary,
}: {
  actions: SessionSummaryActions;
  /** The learner's buddy, glad about the day's rewards; null before one is picked. */
  buddy: LearnBuddy | null;
  exitHref: string;
  goalKind: SummaryGoalKind;
  /** The ceremony screen for the session's one milestone, shown between the steps. */
  renderCeremony?: CeremonyRenderer;
  /** For guests: after their first session, "Save your plan" asks for an account. */
  signUpHref?: string | null;
  summary: StudySessionSummary;
}) {
  return (
    <SessionSummaryProvider
      value={{ actions, buddy, ceremony: renderCeremony, exitHref, goalKind, signUpHref, summary }}
    >
      <SummarySteps />
    </SessionSummaryProvider>
  );
}
