import { AdminSection } from "@/components/admin-section";
import { listUserActivity } from "@/data/users/list-user-activity";
import { formatCount, formatDate } from "@/lib/format";
import { formatDuration } from "@/lib/format-duration";
import { type ChartPointDetail } from "@zoonk/ui/components/chart-inspector";
import {
  ContributionCalendar,
  ContributionCalendarContent,
  ContributionCalendarDay,
  ContributionCalendarGrid,
  ContributionCalendarLegend,
  ContributionCalendarLegendLabel,
  ContributionCalendarLegendSwatch,
  ContributionCalendarPeriod,
  ContributionCalendarViewport,
  ContributionCalendarWeek,
} from "@zoonk/ui/components/contribution-calendar";
import {
  getContributionCalendarDateKey,
  getContributionCalendarDateRange,
  getContributionCalendarDates,
  getContributionCalendarMonthDate,
  getContributionCalendarWeekKey,
  groupContributionCalendarDaysByWeek,
} from "@zoonk/utils/contribution-calendar";

/** Blue means studied, as on the learner's own Activity page. */
const INTENSITY_CLASSES = [
  "bg-surface-3",
  "bg-success/25",
  "bg-success/45",
  "bg-success/70",
  "bg-success",
] as const;

const LEVELS = INTENSITY_CLASSES.length - 1;

/** Relative bands, so quieter days still tell apart from busier ones. */
function intensityClass({ longest, seconds }: { longest: number; seconds: number }): string {
  if (seconds === 0 || longest === 0) {
    return INTENSITY_CLASSES[0];
  }

  return INTENSITY_CLASSES[Math.max(1, Math.ceil((seconds / longest) * LEVELS))] ?? "";
}

const MONTH = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

type ActivityDay = { date: Date; index: number; row?: { timeSpentSeconds: number } };

function ActivityWeek({ longest, week }: { longest: number; week: ActivityDay[] }) {
  const month = getContributionCalendarMonthDate(week);

  return (
    <ContributionCalendarWeek>
      {month ? (
        <ContributionCalendarPeriod>{MONTH.format(month)}</ContributionCalendarPeriod>
      ) : null}
      {week.map((day) => (
        <ContributionCalendarDay
          className={intensityClass({ longest, seconds: day.row?.timeSpentSeconds ?? 0 })}
          index={day.index}
          key={day.index}
        />
      ))}
    </ContributionCalendarWeek>
  );
}

const TITLE = "Study time by day, the last 12 months";

/** The last 12 months, a square a day, as the learner's own Activity page draws them. */
export async function UserActivity({ userId }: { userId: string }) {
  "use cache: private";

  // oxlint-disable-next-line react/purity -- A cached Server Component reads the time once per cache entry and never re-renders on the client.
  const range = getContributionCalendarDateRange({ now: new Date() });
  const rows = await listUserActivity(userId, range.startDate);
  const byDay = new Map(rows.map((row) => [getContributionCalendarDateKey(row.date), row]));
  const longest = Math.max(0, ...rows.map((row) => row.timeSpentSeconds));

  const days = getContributionCalendarDates(range).map((date, index) => ({
    date,
    index,
    row: byDay.get(getContributionCalendarDateKey(date)),
  }));

  const details = days.map(({ date, row }): ChartPointDetail => [
    formatDate(date),
    row ? formatDuration(row.timeSpentSeconds) : "No study",
    row && row.lessonsCompleted > 0 ? formatCount(row.lessonsCompleted, "lesson") : undefined,
  ]);

  const weeks = groupContributionCalendarDaysByWeek(days);
  const studied = rows.filter((row) => row.timeSpentSeconds > 0).length;

  return (
    <AdminSection
      action={
        <ContributionCalendarLegend aria-label="Study time from less to more">
          <ContributionCalendarLegendLabel>Less</ContributionCalendarLegendLabel>
          {INTENSITY_CLASSES.map((className) => (
            <ContributionCalendarLegendSwatch className={className} key={className} />
          ))}
          <ContributionCalendarLegendLabel>More</ContributionCalendarLegendLabel>
        </ContributionCalendarLegend>
      }
      description={`Studied on ${formatCount(studied, "day")}`}
      title="The last 12 months"
    >
      <ContributionCalendar
        aria-label={TITLE}
        defaultIndex={Math.max(
          0,
          days.findLastIndex((day) => day.row),
        )}
        details={details}
        weeks={weeks.length}
      >
        <ContributionCalendarViewport>
          <ContributionCalendarContent>
            <ContributionCalendarGrid aria-label={TITLE}>
              {weeks.map((week) => (
                <ActivityWeek
                  key={getContributionCalendarWeekKey(week)}
                  longest={longest}
                  week={week}
                />
              ))}
            </ContributionCalendarGrid>
          </ContributionCalendarContent>
        </ContributionCalendarViewport>
      </ContributionCalendar>
    </AdminSection>
  );
}
