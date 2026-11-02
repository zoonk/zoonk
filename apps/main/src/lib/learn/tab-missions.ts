import { type LearnerSummaryDay } from "@zoonk/core/learner/summary/contract";
import { type Mission, countMissions } from "@zoonk/core/sessions/missions";
import { type LearnTabMissions } from "@zoonk/learn/navigation";

/** Null on a day without missions, so the tab wears no empty ring. */
export function countTabMissions(
  missions: readonly Pick<Mission, "status">[] | null,
): LearnTabMissions {
  return countMissions(missions ?? []);
}

export type TabMissionsReport = {
  day: LearnerSummaryDay;
  missions: LearnTabMissions;
  readAt: number;
  userId: string;
};

/** An older read never replaces a newer one. */
export type TabMissionsReports = Readonly<Record<string, TabMissionsReport>>;

export type TabMissionsScope = { day: LearnerSummaryDay; learnerId: string };

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

export function findTabMissionsReport({
  reports,
  scope,
}: {
  reports: TabMissionsReports;
  scope: TabMissionsScope | null;
}): TabMissionsReport | null {
  return scope ? (reports[toReportKey({ day: scope.day, userId: scope.learnerId })] ?? null) : null;
}
