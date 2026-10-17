"use client";

import { useExtracted } from "next-intl";
import { SuggestionLinkAction } from "../_components/suggestion";
import { useLearnRoutes } from "../learn-context";
import { type PlanChangeContent } from "../plan/use-system-change-sentence";
import { useTodayCountsByDate } from "./today-change-sentence";

/**
 * A notice whose lessons no longer fit by the date ahead offers one way to act, directly in the
 * existing Plan editor. A plan without a date ahead keeps every lesson (one with no date, one past
 * its date, an exam studied past the exam), so fewer of them leaves nothing to win back.
 */
export function AdjustPlanLink({ change }: { change: PlanChangeContent }) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const countsByDate = useTodayCountsByDate();
  const fewer = (change.effect?.lessonsRemoved ?? 0) > (change.effect?.lessonsAdded ?? 0);

  if (change.status === "proposed" || change.canUndo || !fewer || !countsByDate(change)) {
    return null;
  }

  return (
    <SuggestionLinkAction href={`${routes.journey}?focus=adjust`} variant="outline">
      {t("Adjust plan")}
    </SuggestionLinkAction>
  );
}
