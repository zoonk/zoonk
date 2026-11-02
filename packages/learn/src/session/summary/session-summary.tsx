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
  /** `null` draws the default buddy. */
  buddy: LearnBuddy | null;
  exitHref: string;
  goalKind: SummaryGoalKind;
  mistakesHref?: string | null;
  renderCeremony?: CeremonyRenderer;
  signUpHref?: string | null;
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
