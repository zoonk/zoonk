import { type Mission, countMissions } from "@zoonk/core/sessions/missions";
import { type LearnTabMissions } from "@zoonk/learn/navigation";

/**
 * Today's missions as the buddy's tab counts them, or null on a day without any, so the tab wears
 * no empty ring. The frame's read (the learner summary) and the pages' own reads count them the
 * same way.
 */
export function countTabMissions(missions: readonly Mission[] | null): LearnTabMissions {
  return countMissions(missions ?? []);
}

/** Today's missions as one page's read counted them, when it ran, and for whom (its viewer). */
export type TabMissionsReport = { missions: LearnTabMissions; readAt: number; userId: string };

/** The newest page read for each learner: an older read never replaces a newer one. */
export type TabMissionsReports = Readonly<Record<string, TabMissionsReport>>;

export function addTabMissionsReport(
  reports: TabMissionsReports,
  report: TabMissionsReport,
): TabMissionsReports {
  const held = reports[report.userId];
  return held && held.readAt > report.readAt ? reports : { ...reports, [report.userId]: report };
}

/**
 * The page read the buddy's tab may show: only one made for the learner the frame holds, so a
 * read that left as another account (or arrives after it signed out) never shows.
 */
export function findTabMissionsReport({
  learnerId,
  reports,
}: {
  learnerId: string | null;
  reports: TabMissionsReports;
}): TabMissionsReport | null {
  return learnerId ? (reports[learnerId] ?? null) : null;
}
