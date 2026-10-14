"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { type Mission } from "@zoonk/core/sessions/missions";
import { type LearnTabMissions } from "@zoonk/learn/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import {
  type TabMissionsReport,
  type TabMissionsReports,
  addTabMissionsReport,
  countTabMissions,
  findTabMissionsReport,
} from "./tab-missions";

const TabMissionsContext = createContext<{
  newest: TabMissionsReport | null;
  report: (read: TabMissionsReport) => void;
} | null>(null);

/** Whose reads count: the learner the summary holds; nobody's while it holds no one. */
function useLearnerId(): string | null {
  const learner = useLearnerSummary();
  return learner.status === "ready" ? learner.summary.identity.userId : null;
}

/**
 * Keeps the newest count of today's missions the pages read, for the buddy's tab. The frame keeps
 * its summary while the learner moves between pages, and a page reads the missions again after
 * every answer: the tab said "0 of 2" beside a buddy page saying "1/2". A read counts only for the
 * learner it was made for (its viewer), so another account (or a visitor) taking the session never
 * wears it, even when it arrives late.
 */
export function TabMissionsProvider({ children }: { children: React.ReactNode }) {
  const learnerId = useLearnerId();
  const [reports, setReports] = useState<TabMissionsReports>({});

  const report = useCallback((read: TabMissionsReport) => {
    setReports((current) => addTabMissionsReport(current, read));
  }, []);

  const newest = findTabMissionsReport({ learnerId, reports });
  const value = useMemo(() => ({ newest, report }), [newest, report]);

  return <TabMissionsContext value={value}>{children}</TabMissionsContext>;
}

/**
 * A page that read today's missions with its own data hands them to the buddy's tab, for the
 * learner that read was made for (`userId`, its viewer).
 */
export function useReportTabMissions({
  missions,
  readAt,
  userId,
}: {
  missions: readonly Mission[] | null;
  readAt: number;
  userId: string;
}) {
  const report = use(TabMissionsContext)?.report;
  const count = countTabMissions(missions);
  const done = count?.done;
  const total = count?.total;

  useEffect(() => {
    report?.({
      missions: done === undefined || total === undefined ? null : { done, total },
      readAt,
      userId,
    });
  }, [done, readAt, report, total, userId]);
}

/**
 * The count the buddy's tab shows: the frame's own read, unless a page read them since. A read at
 * the same moment is the page's, which runs after Today builds the day's session.
 */
export function useTabMissions({
  missions,
  readAt,
}: {
  missions?: LearnTabMissions;
  readAt?: number;
}): LearnTabMissions | undefined {
  const newest = use(TabMissionsContext)?.newest;

  if (newest && (readAt === undefined || newest.readAt >= readAt)) {
    return newest.missions;
  }

  return missions;
}
