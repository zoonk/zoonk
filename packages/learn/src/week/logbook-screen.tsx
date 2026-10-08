"use client";

import { useExtracted, useFormatter } from "next-intl";
import { useEffect } from "react";
import { Steps, type StepsItem } from "../_components/steps";
import { useLearnAnalytics } from "../learn-context";
import { TaskMainLink } from "../shell/task-frame";
import {
  type LogbookHrefs,
  LogbookProvider,
  type WeeklyRecapView,
  useLogbook,
} from "./logbook-context";
import {
  LearnedStep,
  NextWeekStep,
  QuietWeekStep,
  TurnaroundStep,
  WeekStep,
  hasLearned,
} from "./logbook-sections";

/**
 * "Sep 21 – 27". Node's ICU puts thin spaces around the dash and browsers plain ones, so the
 * spaces are normalized to render the same on the server and in the browser (no hydration error).
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

/** The week's steps: the week in one line, its biggest turnaround, what it added up to, next week. */
function useWeekItems(): StepsItem[] {
  const { recap } = useLogbook();
  const range = useWeekRange();

  // Before the first finished week, or a week without study, there's one calm thing to say.
  if (!recap.ready || recap.week.daysStudied.length === 0) {
    return [{ content: <QuietWeekStep range={range} />, id: "week" }];
  }

  return [
    { content: <WeekStep range={range} />, id: "week" },
    recap.turnaround && { content: <TurnaroundStep />, id: "turnaround" },
    hasLearned(recap) && { content: <LearnedStep />, id: "learned" },
    recap.nextFocus && { content: <NextWeekStep title={recap.nextFocus.title} />, id: "next" },
  ].filter((item) => item !== null && item !== false);
}

function WeeklySummarySteps() {
  const t = useExtracted();
  const { hrefs } = useLogbook();
  const items = useWeekItems();

  return (
    <Steps
      exitHref={hrefs.close}
      finalAction={<TaskMainLink href={hrefs.start}>{t("Let's go")}</TaskMainLink>}
      items={items}
    />
  );
}

/**
 * The week's recap from core, one thing at a time: the week in the learner's own numbers, the
 * biggest turnaround and why, what it added up to and what next week brings. Nothing here is
 * written by a model.
 */
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
      <WeeklySummarySteps />
    </LogbookProvider>
  );
}
