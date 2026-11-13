"use client";

import { useExtracted, useFormatter } from "next-intl";
import { useEffect } from "react";
import { StepCard } from "../_components/step-card";
import { TaskActions } from "../_components/task-layout";
import { useLearnAnalytics } from "../learn-context";
import { TaskFrame, TaskMainLink } from "../shell/task-frame";
import {
  type LogbookHrefs,
  LogbookProvider,
  type WeeklyRecapView,
  useLogbook,
} from "./logbook-context";
import { WeekHeader, WeekRings, WeekRows, WeekTiles } from "./logbook-sections";

/**
 * Node's ICU puts thin spaces around the dash and browsers plain ones, so the spaces are normalized
 * to hydrate cleanly.
 */
function useWeekRange(): string {
  const format = useFormatter();
  const { recap } = useLogbook();

  return format
    .dateTimeRange(recap.weekStart, recap.weekEnd, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
    .replaceAll("\u2009", " ");
}

function WeeklySummary() {
  const t = useExtracted();
  const { hrefs, recap } = useLogbook();
  const range = useWeekRange();
  const studied = recap.ready && recap.week.daysStudied.length > 0;

  return (
    <TaskFrame
      exitHref={hrefs.close}
      footer={
        <TaskActions>
          <TaskMainLink href={hrefs.start}>{t("Done")}</TaskMainLink>
        </TaskActions>
      }
    >
      <StepCard>
        <WeekRings />
        <WeekHeader range={range} />
        {studied && <WeekTiles />}
        {studied && <WeekRows />}
      </StepCard>
    </TaskFrame>
  );
}

/** Nothing here is written by a model. */
export function LogbookScreen({
  hrefs,
  learnerName,
  recap,
}: {
  hrefs: LogbookHrefs;
  learnerName: string | null;
  recap: WeeklyRecapView;
}) {
  const analytics = useLearnAnalytics();

  useEffect(() => {
    analytics.track({ name: "Logbook Viewed" });
  }, [analytics]);

  return (
    <LogbookProvider value={{ hrefs, learnerName, recap }}>
      <WeeklySummary />
    </LogbookProvider>
  );
}
