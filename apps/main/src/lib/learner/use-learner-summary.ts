"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { checkIdentity, onLearnerIdentityChange, takeOwnGuestPageRead } from "./learner-identity";
import { type LearnerSummaryState } from "./learner-snapshot";
import {
  ensureLearnerSummary,
  getLearnerSummaryState,
  getServerLearnerSummaryState,
  subscribeToLearnerSummary,
} from "./learner-store";

/**
 * The learner summary for a component that shows it, read when it isn't yet: the server's render
 * and the first paint hold `not-loaded`, so they match.
 */
export function useLearnerSummary(): LearnerSummaryState {
  const state = useSyncExternalStore(
    subscribeToLearnerSummary,
    getLearnerSummaryState,
    getServerLearnerSummaryState,
  );

  useEffect(() => {
    ensureLearnerSummary();
  }, []);

  return state;
}

/**
 * Reads the page again, softly, when it was drawn for nobody and a learner now holds the session
 * (signed in in another tab), and once on the first page shown after this tab made its own guest
 * (the router may hold that page as drawn for nobody). A page drawn for a learner never reads
 * itself again for someone else: it reloads (`learner-identity.ts`). Next's own router, since the
 * frame's sync sits outside the app's translations, which `@/i18n/navigation` needs; it checks the
 * page's learner before it moves, as that router does.
 */
export function useRefreshOnLearnerChange(): void {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(
    () =>
      onLearnerIdentityChange(() => {
        if (checkIdentity()) {
          router.refresh();
        }
      }),
    [router],
  );

  useEffect(() => {
    if (takeOwnGuestPageRead() && checkIdentity()) {
      router.refresh();
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Each page shown asks once.
  }, [pathname, router]);
}
