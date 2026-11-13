import "server-only";
import { STUCK_RUNNING_MINUTES, countGenerationFailures } from "@/data/ai/get-generation-failures";
import { listDailyAiSpendBetween } from "@/data/ai/list-daily-ai-spend";
import { type InboxQueue, getInbox } from "@/data/inbox/get-inbox";
import { countMissingAudio } from "@/data/media/list-missing-audio";
import { countActiveLearners } from "@/data/stats/count-active-learners";
import { getActiveLearnerTrend } from "@/data/stats/get-active-learner-trend";
import { getDailySignups } from "@/data/stats/get-daily-signups";
import { getLearningTimeTrend } from "@/data/stats/get-learning-time-trend";
import { formatDate } from "@/lib/format";
import { getRollingUtcDateWindowStarts } from "@/lib/rolling-date-windows";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { sumOf } from "@zoonk/utils/number";
import { type Route } from "next";

export type AttentionItem = {
  count: number;
  detail: string;
  /** Something broke, where the other rows are work waiting its turn. */
  failed?: boolean;
  href: Route;
  title: string;
};

const MINUTES_PER_HOUR = 60;

function since({ oldest }: InboxQueue): string {
  return oldest ? `, the oldest from ${formatDate(oldest)}` : "";
}

/** Only what has something waiting: an empty queue isn't shown. */
export async function loadAttention(): Promise<AttentionItem[]> {
  const [inbox, failures, missingAudio] = await Promise.all([
    getInbox(),
    countGenerationFailures(),
    countMissingAudio(),
  ]);

  const failed = sumOf(failures.map((row) => row.failed));
  const stuck = sumOf(failures.map((row) => row.stuck));

  const rows: AttentionItem[] = [
    {
      count: failed + stuck,
      detail: `${failed} failed · ${stuck} started over ${STUCK_RUNNING_MINUTES / MINUTES_PER_HOUR} hour ago and never finished`,
      failed: true,
      href: "/ai?tab=failed",
      title: "Failed AI runs",
    },
    {
      count: inbox.feedback.count,
      detail: `New messages${since(inbox.feedback)}`,
      href: "/feedback/messages",
      title: "Feedback",
    },
    {
      count: inbox.contentFixes.count,
      detail: `Waiting for approval${since(inbox.contentFixes)}`,
      href: "/content-fixes",
      title: "Content fixes",
    },
    {
      count: inbox.sourceChanges.count,
      detail: `Lessons and questions that cite a changed source${since(inbox.sourceChanges)}`,
      href: "/review-flags",
      title: "Source changes",
    },
    {
      count: inbox.accountDeletions.count,
      detail: `Analytics to delete by hand${since(inbox.accountDeletions)}`,
      href: "/account-deletions",
      title: "Account deletions",
    },
    {
      count: missingAudio,
      detail: "Words and sentences without audio",
      href: "/media/missing-audio",
      title: "Missing audio",
    },
  ];

  return rows.filter((row) => row.count > 0);
}

export const WEEK_DAYS = 7;

export type WeekNumber = {
  current: number;
  /** One value a day, the 7 days before first and then the last 7. */
  daily: number[];
  previous: number;
};

/** Daily rows exist only for days with something in them, so the days without read zero. */
function toDaily({
  rows,
  start,
}: {
  rows: { count: number; date: Date }[];
  start: Date;
}): number[] {
  const byDay = new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), row.count]));

  return Array.from({ length: WEEK_DAYS * 2 }, (_, index) => {
    const day = new Date(start.getTime() + index * MS_PER_DAY);
    return byDay.get(day.toISOString().slice(0, 10)) ?? 0;
  });
}

function halves(daily: number[]): WeekNumber {
  return {
    current: sumOf(daily.slice(WEEK_DAYS)),
    daily,
    previous: sumOf(daily.slice(0, WEEK_DAYS)),
  };
}

/**
 * The last 7 days beside the 7 before, day by day: each tile's number, its comparison and its
 * sparkline come from one read of its 14 days. Active learners are counted per period as well,
 * since someone who studied on three days is one learner.
 */
export async function loadWeek(now: Date) {
  const { currentPeriodStart, previousPeriodStart } = getRollingUtcDateWindowStarts({
    days: WEEK_DAYS,
    now,
  });

  const [activeLearners, activeDaily, signups, time, spend] = await Promise.all([
    countActiveLearners({ currentPeriodStart, previousPeriodStart }),
    getActiveLearnerTrend(previousPeriodStart, now, "month"),
    getDailySignups(previousPeriodStart, now),
    getLearningTimeTrend(previousPeriodStart, now, "month"),
    listDailyAiSpendBetween(previousPeriodStart, now),
  ]);

  return {
    activeLearners: {
      current: activeLearners.currentPeriod,
      daily: toDaily({ rows: activeDaily, start: previousPeriodStart }),
      previous: activeLearners.previousPeriod,
    },
    signups: halves(toDaily({ rows: signups, start: previousPeriodStart })),
    spend: halves(spend.map((row) => row.costUsd)),
    time: halves(toDaily({ rows: time, start: previousPeriodStart })),
  } satisfies Record<string, WeekNumber>;
}
