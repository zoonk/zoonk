import { Button } from "@zoonk/ui/components/button";
import Link from "next/link";
import {
  type LeaderboardPeriod,
  leaderboardPeriodLabels,
  leaderboardPeriods,
} from "./leaderboard-period";

/** URL-backed links keep leaderboard periods shareable without adding client state. */
export function LeaderboardPeriodFilter({ period }: { period: LeaderboardPeriod }) {
  return (
    <nav aria-label="Leaderboard period filter" className="flex flex-wrap gap-1">
      {leaderboardPeriods.map((item) => (
        <Button
          key={item}
          nativeButton={false}
          render={
            <Link
              aria-current={period === item ? "page" : undefined}
              href={getLeaderboardPeriodHref(item)}
              prefetch
            />
          }
          size="sm"
          variant={period === item ? "default" : "outline"}
        >
          {leaderboardPeriodLabels[item]}
        </Button>
      ))}
    </nav>
  );
}

/** Switching periods resets pagination so a shorter period cannot open an empty page. */
function getLeaderboardPeriodHref(
  period: LeaderboardPeriod,
): "/leaderboard" | `/leaderboard?${string}` {
  return period === "today" ? "/leaderboard" : `/leaderboard?period=${period}`;
}
