"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "../_components/page";
import { TITLE_ROW_CLASS } from "../_components/title-row";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { useShortDayRange } from "../plan/use-short-plan";
import { useTodayScreen } from "./today-context";
import { DayTime } from "./today-day-progress";
import { useWelcomeBack } from "./use-today-copy";

function NotEnoughTime() {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <p className="text-pretty">
      {t("Not enough time left for all your lessons.")}{" "}
      <LearnLink
        className="text-foreground hit-area focus-visible:ring-ring/50 relative inline-flex items-center gap-0.5 rounded-sm font-medium outline-none focus-visible:ring-[3px]"
        href={routes.journey}
      >
        {t("Adjust your plan")}
        <ChevronRightIcon aria-hidden="true" className="size-4" />
      </LearnLink>
    </p>
  );
}

/**
 * One line at most, and only what changes today: a normal day has none. A return after days away
 * leads with its welcome, so the plan's state waits for the learner to start.
 */
function TodayLine() {
  const t = useExtracted();
  const dayRange = useShortDayRange();
  const welcomeBack = useWelcomeBack();
  const { today } = useTodayScreen();
  const { exam, goal, shortPlan } = today;

  if (welcomeBack) {
    return (
      <PageSubtitle data-slot="today-welcome-back">
        <p className="text-pretty">
          {t("Welcome back. Today is short, so it's easy to start again.")}
        </p>
      </PageSubtitle>
    );
  }

  if (shortPlan) {
    return (
      <PageSubtitle>
        {dayRange({ days: shortPlan.days, first: shortPlan.day, last: shortPlan.day })}
      </PageSubtitle>
    );
  }

  if (today.progress?.status?.kind === "needsAdjusting") {
    return (
      <PageSubtitle>
        <NotEnoughTime />
      </PageSubtitle>
    );
  }

  if (exam?.stage === "finalStretch" && goal.daysLeft !== null) {
    return (
      <PageSubtitle>
        {t("{exam} in {days, plural, one {# day} other {# days}}", {
          days: goal.daysLeft,
          exam: exam.examName,
        })}
      </PageSubtitle>
    );
  }

  return null;
}

export function TodayHeading({ className }: { className?: string }) {
  const t = useExtracted();

  return (
    <PageHeader className={className}>
      <PageHeaderContent className="w-full">
        <div className={cn(TITLE_ROW_CLASS, "items-baseline")}>
          <PageTitle>{t("Today")}</PageTitle>
          <DayTime className="text-2xl" />
        </div>

        <TodayLine />
      </PageHeaderContent>
    </PageHeader>
  );
}
