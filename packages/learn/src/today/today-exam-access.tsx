"use client";

import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { useFreeWeekOverCopy } from "../_components/free-week-over";
import {
  Suggestion,
  SuggestionActions,
  SuggestionContent,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionLinkAction,
  SuggestionSummary,
} from "../_components/suggestion";
import { useLearnAnalytics } from "../learn-context";
import { useTodayScreen } from "./today-context";

export function TodayExamAccess() {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
  const copy = useFreeWeekOverCopy();
  const { actions, today } = useTodayScreen();
  const { trialEnded } = today.session.examAccess;

  useEffect(() => {
    if (trialEnded) {
      analytics.track({ name: "Subscription Gate Shown" });
    }
  }, [analytics, trialEnded]);

  if (!trialEnded) {
    return null;
  }

  return (
    <Suggestion label={t("Exam prep on the free plan")} mark={<SparklesIcon />}>
      <SuggestionLine>
        <SuggestionSummary>{copy.title}</SuggestionSummary>
        <SuggestionLinkAction className="shrink-0" href={actions.plusHref} variant="outline">
          {t("See Plus")}
        </SuggestionLinkAction>
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{copy.title}</SuggestionHeader>
        <SuggestionDescription>{copy.body}</SuggestionDescription>
        <SuggestionActions>
          <SuggestionLinkAction href={actions.plusHref} variant="outline">
            {t("See Plus")}
          </SuggestionLinkAction>
        </SuggestionActions>
      </SuggestionContent>
    </Suggestion>
  );
}
