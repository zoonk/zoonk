"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { useLearnAnalytics } from "../learn-context";
import { LearnLink } from "../learn-link";
import { useTodayScreen } from "./today-context";

/**
 * A free exam plan past its first week: the day's new lessons and practice stop, while reviews
 * and fixing mistakes carry on. Today says so once, calmly, instead of lessons quietly
 * disappearing, and offers Plus for the rest of the plan and mock exams.
 */
export function TodayExamAccess() {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
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
    <aside
      aria-label={t("Exam prep on the free plan")}
      className="bg-muted/60 in-data-[mode=fun]:fun-glass flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
    >
      <LineMarker>
        <SparklesIcon
          aria-hidden="true"
          className="text-primary in-data-[mode=fun]:text-fun-accent-lime size-4"
        />
      </LineMarker>

      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">{t("Your free week of exam prep is over")}</p>

        <p className="text-muted-foreground leading-relaxed">
          {t(
            "Reviews and fixing your mistakes stay free. Plus opens new lessons, the rest of your plan and mock exams.",
          )}
        </p>

        <LearnLink
          className="text-foreground w-fit font-medium underline underline-offset-4"
          href={actions.plusHref}
        >
          {t("See Plus")}
        </LearnLink>
      </div>
    </aside>
  );
}
