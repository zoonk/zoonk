"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { PageEyebrow, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { TITLE_ROW_CLASS } from "../_components/title-row";
import { daysBetween } from "../_utils/iso-date";
import { PLAN_TITLE_ID, usePlanScreen } from "../plan/plan-context";

export function PlanEyebrow() {
  const t = useExtracted();
  const { goal, plan, today } = usePlanScreen();
  const { targetDate, targetDateEstimated } = plan.schedule;

  if (!targetDate || targetDate < today) {
    return <PageEyebrow>{goal.displayName}</PageEyebrow>;
  }

  const days = daysBetween(today, targetDate);

  if (!targetDateEstimated) {
    return (
      <PageEyebrow>
        {`${goal.displayName} · `}
        {t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", { days })}
      </PageEyebrow>
    );
  }

  return (
    <PageEyebrow>
      {`${goal.displayName} · `}
      <span aria-hidden="true">
        {t("{days, plural, one {~# day left} other {~# days left}}", { days })}
      </span>
      <span className="sr-only">
        {t("{days, plural, one {About # day left} other {About # days left}}", { days })}
      </span>
    </PageEyebrow>
  );
}

export function PlanHeader({
  children,
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow: React.ReactNode;
}) {
  const t = useExtracted();

  return (
    <PageHeaderContent>
      {eyebrow}
      <PageHeader className={cn(TITLE_ROW_CLASS, "gap-y-2")}>
        <PageTitle className="outline-none" id={PLAN_TITLE_ID} tabIndex={-1}>
          {t("Plan")}
        </PageTitle>

        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </PageHeader>
    </PageHeaderContent>
  );
}
