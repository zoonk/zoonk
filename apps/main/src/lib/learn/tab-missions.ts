import { type LearnerSummaryDay } from "@zoonk/core/learner/summary/contract";
import { type Mission, countMissions } from "@zoonk/core/sessions/missions";
import { type LearnTabMissions } from "@zoonk/learn/navigation";

/**
 * Today's missions as the buddy's tab counts them, or null on a day without any, so the tab wears
 * no empty ring. The frame's read (the learner summary) and the pages' own reads count them the
 * same way.
 */
export function countTabMissions(
  missions: readonly Pick<Mission, "status">[] | null,
): LearnTabMissions {
  return countMissions(missions ?? []);
}

/**
 * Today's missions as one page's read counted them: which goal's study day they are (`day`, as the
 * read that produced them names it), when it ran (server time) and for whom (its viewer).
 */
export type TabMissionsReport = {
  day: LearnerSummaryDay;
  missions: LearnTabMissions;
  readAt: number;
  userId: string;
};

/** The newest page read of each learner's study day: an older read never replaces a newer one. */
export type TabMissionsReports = Readonly<Record<string, TabMissionsReport>>;

/** What the frame holds: whose summary, and the study day its missions describe. */
export type TabMissionsScope = { day: LearnerSummaryDay; learnerId: string };

/** A session's learner-local date as the summary names it (`YYYY-MM-DD`). */
export function toStudyDayDate(localDate: Date): string {
  return localDate.toISOString().slice(0, 10);
}

function toReportKey({ day, userId }: { day: LearnerSummaryDay; userId: string }): string {
  return `${userId}:${day.goalId}:${day.localDate}`;
}

export function addTabMissionsReport(
  reports: TabMissionsReports,
  report: TabMissionsReport,
): TabMissionsReports {
  const key = toReportKey(report);
  const held = reports[key];
  return held && held.readAt > report.readAt ? reports : { ...reports, [key]: report };
}

/**
 * The page read the buddy's tab may show: only one made for the learner the frame holds, of the
 * study day its summary describes, so a read that left as another account, for the goal switched
 * away from, or of another day (one that crossed midnight on its way) never shows, even when it
 * arrives late.
 */
export function findTabMissionsReport({
  reports,
  scope,
}: {
  reports: TabMissionsReports;
  scope: TabMissionsScope | null;
}): TabMissionsReport | null {
  return scope ? (reports[toReportKey({ day: scope.day, userId: scope.learnerId })] ?? null) : null;
}
