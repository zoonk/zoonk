"use client";

import { type Mission } from "@zoonk/core/sessions/missions";
import { type LearnTabMissions } from "@zoonk/learn/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { countTabMissions } from "./tab-missions";

/** Today's missions as counted by one read, and when that read ran (`getReadAt`). */
type TabMissionsRead = { missions: LearnTabMissions; readAt: number };

const TabMissionsContext = createContext<{
  newest: TabMissionsRead | null;
  report: (read: TabMissionsRead) => void;
} | null>(null);

/**
 * Keeps the newest count of today's missions the pages read, for the buddy's tab. The frame keeps
 * its first read while the learner moves between pages, and the read before Today builds the day's
 * session has none: the tab said "0 of 2" beside a buddy page saying "1/2".
 */
export function TabMissionsProvider({ children }: { children: React.ReactNode }) {
  const [newest, setNewest] = useState<TabMissionsRead | null>(null);

  const report = useCallback((read: TabMissionsRead) => {
    setNewest((current) => (current && current.readAt > read.readAt ? current : read));
  }, []);

  const value = useMemo(() => ({ newest, report }), [newest, report]);

  return <TabMissionsContext value={value}>{children}</TabMissionsContext>;
}

/** A page that read today's missions with its own data hands them to the buddy's tab. */
export function useReportTabMissions({
  missions,
  readAt,
}: {
  missions: readonly Mission[] | null;
  readAt: number;
}) {
  const report = use(TabMissionsContext)?.report;
  const count = countTabMissions(missions);
  const done = count?.done;
  const total = count?.total;

  useEffect(() => {
    report?.({
      missions: done === undefined || total === undefined ? null : { done, total },
      readAt,
    });
  }, [done, readAt, report, total]);
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
