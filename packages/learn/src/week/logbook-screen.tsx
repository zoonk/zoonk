"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { StatSkeleton } from "@zoonk/ui/components/stat";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { StepCard, StepHeader } from "../_components/step-card";
import { TaskActions } from "../_components/task-layout";
import { toIsoDay, useFormatIsoRange } from "../_utils/iso-date";
import { useLearnAnalytics } from "../learn-context";
import { TaskFrame, TaskMainLink } from "../shell/task-frame";
import {
  type LogbookHrefs,
  LogbookProvider,
  type WeeklyRecapView,
  useLogbook,
} from "./logbook-context";
import { WeekHeader, WeekRings, WeekRingsSkeleton, WeekRows, WeekTiles } from "./logbook-sections";

function useWeekRange(): string {
  const formatRange = useFormatIsoRange();
  const { recap } = useLogbook();
  return formatRange({ end: toIsoDay(recap.weekEnd), start: toIsoDay(recap.weekStart) });
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

/** The summary's own parts with blank lines, so nothing moves when the week arrives. */
export function LogbookSkeleton() {
  return (
    <StepCard aria-hidden="true">
      <WeekRingsSkeleton />
      <StepHeader className="w-full">
        <Skeleton className="h-5.5 w-40 rounded-sm" data-slot="eyebrow" />
        <Skeleton className="text-title w-2/3">{"\u00A0"}</Skeleton>
        <Skeleton className="w-1/2">{"\u00A0"}</Skeleton>
      </StepHeader>
      <div className="grid w-full grid-cols-2 gap-2">
        <StatSkeleton />
        <StatSkeleton />
      </div>
      <div className="flex w-full flex-col gap-6 py-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
    </StepCard>
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
