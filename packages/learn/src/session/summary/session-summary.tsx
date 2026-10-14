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
 * The end of the session on one screen: what changed today, with what it earned beside it on a
 * wide screen. Right after "Stop for today", what's done so far.
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
  mistakesHref = null,
  renderCeremony,
  signUpHref = null,
  stopped = false,
  summary,
}: {
  actions: SessionSummaryActions;
  /** The learner's buddy, glad about the day's rewards; null resolves to the default buddy. */
  buddy: LearnBuddy | null;
  exitHref: string;
  goalKind: SummaryGoalKind;
  /** The mistakes notebook, for "See mistakes" when the session saved any. */
  mistakesHref?: string | null;
  /** The ceremony screen for the session's one milestone, shown over the summary as it opens. */
  renderCeremony?: CeremonyRenderer;
  /** For guests: after their first session, "Save your plan" asks for an account. */
  signUpHref?: string | null;
  /** The learner just tapped "Stop for today": what's done so far, then Keep going. */
  stopped?: boolean;
  summary: StudySessionSummary;
}) {
  return (
    <SessionSummaryProvider
      value={{
        actions,
        buddy,
        ceremony: renderCeremony,
        exitHref,
        goalKind,
        mistakesHref,
        signUpHref,
        stopped,
        summary,
      }}
    >
      <SummarySteps />
    </SessionSummaryProvider>
  );
}
