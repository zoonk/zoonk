import { AdminFilterNav } from "@/components/admin-filter-nav";
import {
  type LeaderboardPeriod,
  leaderboardPeriodLabels,
  leaderboardPeriods,
} from "./leaderboard-period";

export function LeaderboardPeriodFilter({ period }: { period: LeaderboardPeriod }) {
  return (
    <AdminFilterNav
      label="Leaderboard period filter"
      options={leaderboardPeriods.map((item) => ({
        href: getLeaderboardPeriodHref(item),
        isActive: period === item,
        label: leaderboardPeriodLabels[item],
      }))}
    />
  );
}

function getLeaderboardPeriodHref(
  period: LeaderboardPeriod,
): "/leaderboard" | `/leaderboard?${string}` {
  return period === "today" ? "/leaderboard" : `/leaderboard?period=${period}`;
}
