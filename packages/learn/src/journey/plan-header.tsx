"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { PageEyebrow, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { daysUntilIsoDate, hasIsoDatePassed } from "../_utils/iso-date";
import { PLAN_TITLE_ID, usePlanScreen } from "../plan/plan-context";

/**
 * "ENEM 2026 · 27 days left": the goal, and how far its date is when it has one. A day the plan
 * only estimates reads "~398 days left" and is heard as "About 398 days left".
 */
function JourneyEyebrow() {
  const t = useExtracted();
  const today = useMountTime();
  const { goal, plan } = usePlanScreen();
  const { targetDate, targetDateEstimated } = plan.schedule;

  // A date that passed has nothing to count down to: the pace says where the plan stands.
  if (!targetDate || hasIsoDatePassed({ isoDate: targetDate, today })) {
    return <PageEyebrow>{goal.title}</PageEyebrow>;
  }

  const days = daysUntilIsoDate({ isoDate: targetDate, today });

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

/**
 * The Plan's header: the goal and its days left over the title, and beside the title the page's
 * actions (`children`: "Adjust plan" and the "…").
 */
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
