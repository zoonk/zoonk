"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { DaysLeft } from "../_components/days-left";
import { PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "../_components/page";
import { TITLE_ROW_CLASS } from "../_components/title-row";
import { daysBetween } from "../_utils/iso-date";
import { PLAN_TITLE_ID, usePlanScreen } from "../plan/plan-context";

/**
 * The days left to the goal's date, under the Plan's title. The top bar names the goal on every
 * width, so the line doesn't; a goal without a date to come has none.
 */
export function usePlanDaysLeft(): React.ReactNode {
  const { plan, today } = usePlanScreen();
  const { targetDate, targetDateEstimated } = plan.schedule;

  if (!targetDate || targetDate < today) {
    return null;
  }

  return <DaysLeft days={daysBetween(today, targetDate)} estimated={targetDateEstimated} />;
}

export function PlanHeader({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  const t = useExtracted();

  return (
    <PageHeader>
      <PageHeaderContent className="w-full">
        <div className={cn(TITLE_ROW_CLASS, "gap-y-2")}>
          <PageTitle className="outline-none" id={PLAN_TITLE_ID} tabIndex={-1}>
            {t("Plan")}
          </PageTitle>

          <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>

        {subtitle && (
          <PageSubtitle>
            <p>{subtitle}</p>
          </PageSubtitle>
        )}
      </PageHeaderContent>
    </PageHeader>
  );
}
