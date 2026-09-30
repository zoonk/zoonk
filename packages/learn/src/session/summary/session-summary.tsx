"use client";

import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { useExperienceMode } from "../../mode-provider";
import { type StudySessionSummary } from "../session-types";
import { FocusSummary } from "./focus-summary";
import { FunSummary } from "./fun-summary";
import {
  type CeremonyRenderer,
  type SessionSummaryActions,
  SessionSummaryProvider,
} from "./summary-context";

/**
 * The end of the session in the learner's mode: Focus says what changed today, Fun lets the buddy
 * eat what was learned. Both read the same summary.
 *
 * ```tsx
 * <SessionSummary actions={actions} buddy={buddy} summary={summary} />
 * ```
 */
export function SessionSummary({
  actions,
  buddy,
  renderCeremony,
  signUpHref = null,
  summary,
}: {
  actions: SessionSummaryActions;
  buddy: LearnBuddy | null;
  /** The ceremony screen for the session's one milestone; without it, a quiet line. */
  renderCeremony?: CeremonyRenderer;
  /** For guests: after their first session, "Save your plan" asks for an account. */
  signUpHref?: string | null;
  summary: StudySessionSummary;
}) {
  const mode = useExperienceMode();

  return (
    <SessionSummaryProvider
      value={{ actions, buddy, ceremony: renderCeremony, signUpHref, summary }}
    >
      {mode === "fun" ? <FunSummary /> : <FocusSummary />}
    </SessionSummaryProvider>
  );
}
