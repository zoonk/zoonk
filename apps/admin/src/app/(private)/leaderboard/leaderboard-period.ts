export const leaderboardPeriods = ["today", "7d", "30d"] as const;

export type LeaderboardPeriod = (typeof leaderboardPeriods)[number];

/** Today is empty until someone studies, so the page opens on the week. */
export const DEFAULT_LEADERBOARD_PERIOD: LeaderboardPeriod = "7d";

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

export function parseLeaderboardPeriod(value: string | string[] | undefined): LeaderboardPeriod {
  const period = Array.isArray(value) ? value[0] : value;

  return leaderboardPeriods.find((item) => item === period) ?? DEFAULT_LEADERBOARD_PERIOD;
}

export function getLeaderboardPeriodDays(period: LeaderboardPeriod): number {
  return leaderboardPeriodDays[period];
}
