"use client";

import { type AnalyticsGoalKind } from "@zoonk/core/analytics/shared-properties";
import {
  type GoalUnderstandingView,
  type OnboardingDraftView,
} from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted, useLocale } from "next-intl";
import { type OnboardingActions } from "../onboarding-actions";

/** A quick explanation takes about five minutes. */
const EXPLANATION_MINUTES = 5;

/** Musicianship starts with a gentle daily time. */
const MUSICIANSHIP_MINUTES = 15;

/** What analytics calls the typed goal: its goal kind, or declined when the app can't plan it. */
export function getClassifiedKind(
  understanding: GoalUnderstandingView,
): AnalyticsGoalKind | "declined" {
  switch (understanding.status) {
    case "goals":
      return understanding.goals[0]?.draft.kind ?? "learn";
    case "explain":
      return "explain";
    case "instrument":
      return "learn";
    case "unclear":
    case "unsafe":
      return "declined";
    default:
      return "declined";
  }
}

/**
 * Goals that come straight from a read draft, without the card: its quick explanation, or
 * musicianship for an instrument. Both carry the draft's id, which closes the draft.
 */
export function useDraftGoals(actions: OnboardingActions) {
  const t = useExtracted();
  const locale = useLocale();

  const createExplanation = ({
    draft,
    question,
  }: {
    draft: OnboardingDraftView;
    question: string;
  }) =>
    actions.createGoals({
      dailyMinutes: EXPLANATION_MINUTES,
      goals: [
        {
          details: { onboardingId: draft.id, question: draft.prompt },
          kind: "explain",
          language: locale,
          prompt: draft.prompt,
          title: question,
        },
      ],
      timeZone: getLocalTimeZone(),
    });

  const createMusicianship = ({
    draft,
    instrument,
  }: {
    draft: OnboardingDraftView;
    instrument: string;
  }) =>
    actions.createGoals({
      dailyMinutes: MUSICIANSHIP_MINUTES,
      goals: [
        {
          details: { instrument, onboardingId: draft.id, subject: t("musicianship") },
          kind: "learn",
          language: locale,
          prompt: draft.prompt,
          title: t("Musicianship for {instrument}", { instrument }),
        },
      ],
      timeZone: getLocalTimeZone(),
    });

  return { createExplanation, createMusicianship };
}
