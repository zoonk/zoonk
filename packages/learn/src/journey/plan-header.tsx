"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "../_components/page";
import { TITLE_ROW_CLASS } from "../_components/title-row";
import { daysBetween } from "../_utils/iso-date";
import { PLAN_TITLE_ID, usePlanScreen } from "../plan/plan-context";

/** Whose plan this is and how long it has, for the line under the page's title. */
export function PlanGoalLine() {
  const t = useExtracted();
  const { goal, plan, today } = usePlanScreen();
  const { targetDate, targetDateEstimated } = plan.schedule;

  if (!targetDate || targetDate < today) {
    return goal.displayName;
  }

  const days = daysBetween(today, targetDate);

  if (!targetDateEstimated) {
    return (
      <>
        {`${goal.displayName} · `}
        {t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", { days })}
      </>
    );
  }

  return (
    <>
      {`${goal.displayName} · `}
      <span aria-hidden="true">
        {t("{days, plural, one {~# day left} other {~# days left}}", { days })}
      </span>
      <span className="sr-only">
        {t("{days, plural, one {About # day left} other {About # days left}}", { days })}
      </span>
    </>
  );
}

export function PlanHeader({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle: React.ReactNode;
}) {
  const t = useExtracted();

  return (
    <PageHeaderContent>
      <PageHeader className={cn(TITLE_ROW_CLASS, "gap-y-2")}>
        <PageTitle className="outline-none" id={PLAN_TITLE_ID} tabIndex={-1}>
          {t("Plan")}
        </PageTitle>

        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </PageHeader>

      <PageSubtitle>
        <p>{subtitle}</p>
      </PageSubtitle>
    </PageHeaderContent>
  );
}
