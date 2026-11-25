"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { DaysLeft } from "../_components/days-left";
import { PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "../_components/page";
import { TITLE_ROW_CLASS } from "../_components/title-row";
import { PLAN_TITLE_ID, usePlanScreen } from "../plan/plan-context";
import { getPlanDaysLeft } from "./schedule-state";

/**
 * The days left to the goal's date, under the Plan's title (`getPlanDaysLeft`). The top bar names
 * the goal on every width, so the line doesn't.
 */
export function usePlanDaysLeft(): React.ReactNode {
  const { goal, paused = false, plan, today } = usePlanScreen();
  const { targetDate, targetDateEstimated } = plan.schedule;
  const days = getPlanDaysLeft({ exam: goal.kind === "exam", paused, targetDate, today });

  return days === null ? null : <DaysLeft days={days} estimated={targetDateEstimated} />;
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
        <div className={cn(TITLE_ROW_CLASS, "items-start gap-y-2")}>
          <PageTitle className="outline-none" id={PLAN_TITLE_ID} tabIndex={-1}>
            {t("Plan")}
          </PageTitle>

          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">{children}</div>
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
