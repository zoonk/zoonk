"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  PageEyebrow,
  PageHeader,
  PageHeaderContent,
  PageSubtitle,
  PageTitle,
} from "../_components/page";
import { TITLE_ROW_CLASS } from "../_components/title-row";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { useShortDayRange } from "../plan/use-short-plan";
import { useTodayScreen } from "./today-context";
import { DayTime } from "./today-day-progress";
import { useWelcomeBack } from "./use-today-copy";

function PlanDoesNotFit() {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <LearnLink
      className="hover:text-foreground hit-area focus-visible:ring-ring/50 relative inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-[3px]"
      href={routes.journey}
    >
      {t("Your plan doesn't fit")}
      <ChevronRightIcon aria-hidden="true" className="size-3" />
    </LearnLink>
  );
}

/**
 * One part at most, and only what changes today: a normal day has none. A return after days away
 * leads with its welcome, so the plan's state waits for the learner to start.
 */
function TodayEyebrow() {
  const t = useExtracted();
  const dayRange = useShortDayRange();
  const welcomeBack = useWelcomeBack();
  const { today } = useTodayScreen();
  const { exam, goal, shortPlan } = today;

  if (shortPlan) {
    return (
      <PageEyebrow>
        {dayRange({ days: shortPlan.days, first: shortPlan.day, last: shortPlan.day })}
      </PageEyebrow>
    );
  }

  if (today.progress?.status?.kind === "needsAdjusting" && !welcomeBack) {
    return (
      <PageEyebrow>
        <PlanDoesNotFit />
      </PageEyebrow>
    );
  }

  if (exam?.stage === "finalStretch" && goal.daysLeft !== null) {
    return (
      <PageEyebrow>
        {t("{exam} in {days, plural, one {# day} other {# days}}", {
          days: goal.daysLeft,
          exam: exam.examName,
        })}
      </PageEyebrow>
    );
  }

  return null;
}

function WelcomeBack() {
  const t = useExtracted();
  const welcomeBack = useWelcomeBack();

  if (!welcomeBack) {
    return null;
  }

  return (
    <PageSubtitle data-slot="today-welcome-back">
      <p className="text-pretty">
        {t("Welcome back. Today is short, so it's easy to start again.")}
      </p>
    </PageSubtitle>
  );
}

export function TodayHeading({ className }: { className?: string }) {
  const t = useExtracted();

  return (
    <PageHeader className={className}>
      <PageHeaderContent className="w-full">
        <TodayEyebrow />

        <div className={cn(TITLE_ROW_CLASS, "items-baseline")}>
          <PageTitle>{t("Today")}</PageTitle>
          <DayTime className="text-2xl" />
        </div>

        <WelcomeBack />
      </PageHeaderContent>
    </PageHeader>
  );
}
