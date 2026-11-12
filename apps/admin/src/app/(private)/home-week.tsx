import { Stats, StatsSkeleton } from "@/components/stats";
import { getAiSpendBetween } from "@/data/ai/get-ai-spend-between";
import { countActiveLearners } from "@/data/stats/count-active-learners";
import { getNewSignups } from "@/data/stats/get-new-signups";
import { getPeriodLearningTime } from "@/data/stats/get-period-learning-time";
import { formatUsd } from "@/lib/ai-format";
import { formatDuration } from "@/lib/format-duration";
import { getRollingUtcDateWindowStarts } from "@/lib/rolling-date-windows";

const DAYS = 7;
const GRID_CLASS = "grid grid-cols-2 gap-2 lg:grid-cols-4";

/** One comparison for every tile: the same number over the 7 days before. */
function change({
  current,
  format,
  previous,
}: {
  current: number;
  format: (value: number) => string;
  previous: number;
}): string {
  if (current === previous) {
    return "Same as before";
  }

  return `${current > previous ? "Up" : "Down"} from ${format(previous)}`;
}

const formatNumber = (value: number) => value.toLocaleString("en");

export async function HomeWeek() {
  "use cache: private";

  // oxlint-disable-next-line react/purity -- A cached Server Component reads the time once per cache entry and never re-renders on the client.
  const now = new Date();

  const { currentPeriodStart, previousPeriodStart } = getRollingUtcDateWindowStarts({
    days: DAYS,
    now,
  });

  // Daily rows are date-only, so the earlier window ends the instant before this one starts.
  const previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);

  const [activeLearners, signups, previousSignups, time, previousTime, spend, previousSpend] =
    await Promise.all([
      countActiveLearners({ currentPeriodStart, previousPeriodStart }),
      getNewSignups(currentPeriodStart, now),
      getNewSignups(previousPeriodStart, previousPeriodEnd),
      getPeriodLearningTime(currentPeriodStart, now),
      getPeriodLearningTime(previousPeriodStart, previousPeriodEnd),
      getAiSpendBetween(currentPeriodStart, now),
      getAiSpendBetween(previousPeriodStart, currentPeriodStart),
    ]);

  return (
    <div className={GRID_CLASS}>
      <Stats
        description={change({
          current: activeLearners.currentPeriod,
          format: formatNumber,
          previous: activeLearners.previousPeriod,
        })}
        help="Users who completed at least 1 lesson"
        href="/stats/engagement?view=active-learners"
        title="Active learners"
        value={formatNumber(activeLearners.currentPeriod)}
      />

      <Stats
        description={change({ current: signups, format: formatNumber, previous: previousSignups })}
        href="/stats/growth?view=new-signups"
        title="New signups"
        value={formatNumber(signups)}
      />

      <Stats
        description={change({ current: time, format: formatDuration, previous: previousTime })}
        help="Recorded study time across all learners"
        href="/stats/engagement?view=total-learning-time"
        title="Learning time"
        value={formatDuration(time)}
      />

      <Stats
        description={change({ current: spend, format: formatUsd, previous: previousSpend })}
        href="/ai"
        title="AI spend"
        value={formatUsd(spend)}
      />
    </div>
  );
}

export function HomeWeekSkeleton() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 4 }, (_, index) => (
        <StatsSkeleton key={index} />
      ))}
    </div>
  );
}
