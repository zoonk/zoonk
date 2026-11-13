import { AdminBarChart } from "@/components/admin-bar-chart";
import { AdminSection } from "@/components/admin-section";
import { listUserActivity } from "@/data/users/list-user-activity";
import { formatCount } from "@/lib/format";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";

const DAYS = 30;

const DAY_LABEL = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** The last 30 days, a bar a day: whether they are studying now, and when they stopped. */
export async function UserStudyChart({ userId }: { userId: string }) {
  "use cache: private";

  // oxlint-disable-next-line react/purity -- A cached Server Component reads the time once per cache entry and never re-renders on the client.
  const start = new Date(toUTCMidnight(new Date()).getTime() - (DAYS - 1) * MS_PER_DAY);
  const rows = await listUserActivity(userId, start);
  const byDay = new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), row]));

  const points = Array.from({ length: DAYS }, (_, index) => {
    const day = new Date(start.getTime() + index * MS_PER_DAY);

    return {
      label: DAY_LABEL.format(day),
      value: byDay.get(day.toISOString().slice(0, 10))?.timeSpentSeconds ?? 0,
    };
  });

  const studied = rows.filter((row) => row.timeSpentSeconds > 0).length;

  return (
    <AdminSection
      description={
        studied > 0
          ? `Studied on ${formatCount(studied, "day")} of the last ${DAYS}`
          : `No study in the last ${DAYS} days`
      }
      title="Study time"
    >
      {studied > 0 ? (
        <AdminBarChart
          className="h-44 w-full"
          format="duration"
          label="Study time a day, the last 30 days"
          points={points}
        />
      ) : null}
    </AdminSection>
  );
}
