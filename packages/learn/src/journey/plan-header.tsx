"use client";

import { useExtracted } from "next-intl";
import { PageEyebrow, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { daysBetween } from "../_utils/iso-date";
import { PLAN_TITLE_ID, usePlanScreen } from "../plan/plan-context";

function JourneyEyebrow() {
  const t = useExtracted();
  const { goal, plan, today } = usePlanScreen();
  const { targetDate, targetDateEstimated } = plan.schedule;

  if (!targetDate || targetDate < today) {
    return <PageEyebrow>{goal.title}</PageEyebrow>;
  }

  const days = daysBetween(today, targetDate);

  if (!targetDateEstimated) {
    return (
      <PageEyebrow>
        {`${goal.title} · `}
        {t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", { days })}
      </PageEyebrow>
    );
  }

  return (
    <PageEyebrow>
      {`${goal.title} · `}
      <span aria-hidden="true">
        {t("{days, plural, one {~# day left} other {~# days left}}", { days })}
      </span>
      <span className="sr-only">
        {t("{days, plural, one {About # day left} other {About # days left}}", { days })}
      </span>
    </PageEyebrow>
  );
}

export function PlanHeader({ children }: { children: React.ReactNode }) {
  const t = useExtracted();

  return (
    <PageHeaderContent>
      <JourneyEyebrow />
      <PageHeader className="items-center">
        <PageTitle className="outline-none" id={PLAN_TITLE_ID} tabIndex={-1}>
          {t("Plan")}
        </PageTitle>

        <div className="flex shrink-0 items-center gap-1.5">{children}</div>
      </PageHeader>
    </PageHeaderContent>
  );
}
