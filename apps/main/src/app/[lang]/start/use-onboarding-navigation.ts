"use client";

import { useRouter } from "@/i18n/navigation";
import { GOAL_PARAM } from "@/lib/public/public-hrefs";
import { type OnboardingNavigation } from "@zoonk/learn/onboarding/actions";
import { DRAFT_PARAM, START_AGAIN_PARAM } from "./start-params";

/**
 * Puts the draft in the address without a navigation: the screen already shows it, and a refresh
 * reads it back. Other parameters, such as the plan link it started from, stay; the typed goal
 * and "start over" marker don't, since the draft holds the words now.
 */
function replaceDraftParam(draftId: string | null) {
  const url = new URL(globalThis.location.href);

  url.searchParams.delete(GOAL_PARAM);
  url.searchParams.delete(START_AGAIN_PARAM);

  if (draftId) {
    url.searchParams.set(DRAFT_PARAM, draftId);
  } else {
    url.searchParams.delete(DRAFT_PARAM);
  }

  globalThis.history.replaceState(null, "", url);
}

/** Onboarding's page changes through the app's locale-aware router. */
export function useOnboardingNavigation(): OnboardingNavigation {
  const router = useRouter();

  return {
    replaceSteps: (goalId) => router.replace(`/start/${goalId}`),
    showDraft: replaceDraftParam,
    toExplanation: (goalId) => router.push(`/explain/${goalId}`),
    toStart: () => router.push(`/start?${START_AGAIN_PARAM}=${Date.now()}`),
    toSteps: (goalId) => router.push(`/start/${goalId}`),
  };
}
