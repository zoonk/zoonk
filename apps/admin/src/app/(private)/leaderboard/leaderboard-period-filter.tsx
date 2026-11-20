import { AdminTabs } from "@/components/admin-tabs";
import {
  DEFAULT_LEADERBOARD_PERIOD,
  type LeaderboardPeriod,
  leaderboardPeriodLabels,
  leaderboardPeriods,
} from "./leaderboard-period";

export function LeaderboardPeriodFilter({ period }: { period: LeaderboardPeriod }) {
  return (
    <AdminTabs
      label="Period"
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
  return period === DEFAULT_LEADERBOARD_PERIOD ? "/leaderboard" : `/leaderboard?period=${period}`;
}
