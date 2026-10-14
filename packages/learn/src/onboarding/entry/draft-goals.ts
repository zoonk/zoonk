"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted, useLocale } from "next-intl";
import { type OnboardingActions } from "../onboarding-actions";
import { getExplanationGoalInput } from "./understanding-start";

/** Musicianship starts with a gentle daily time. */
const MUSICIANSHIP_MINUTES = 15;

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
  }) => actions.createGoals(getExplanationGoalInput({ draft, language: locale, question }));

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
