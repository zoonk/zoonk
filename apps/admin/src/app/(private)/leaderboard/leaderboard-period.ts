export const leaderboardPeriods = ["today", "7d", "30d"] as const;

export type LeaderboardPeriod = (typeof leaderboardPeriods)[number];

export const leaderboardPeriodLabels: Record<LeaderboardPeriod, string> = {
  "30d": "30 days",
  "7d": "7 days",
  today: "Today",
};

export const leaderboardPeriodDescriptions: Record<LeaderboardPeriod, string> = {
  "30d": "in the past 30 days",
  "7d": "in the past 7 days",
  today: "today",
};

const leaderboardPeriodDays: Record<LeaderboardPeriod, number> = { "30d": 30, "7d": 7, today: 1 };

/** Invalid or repeated URL values fall back to the default Today leaderboard. */
export function parseLeaderboardPeriod(value: string | string[] | undefined): LeaderboardPeriod {
  const period = Array.isArray(value) ? value[0] : value;

  return leaderboardPeriods.find((item) => item === period) ?? "today";
}

export function getLeaderboardPeriodDays(period: LeaderboardPeriod): number {
  return leaderboardPeriodDays[period];
}
