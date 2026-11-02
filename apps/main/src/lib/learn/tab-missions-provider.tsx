"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { type LearnerSummaryDay } from "@zoonk/core/learner/summary/contract";
import { type Mission } from "@zoonk/core/sessions/missions";
import { type LearnTabMissions } from "@zoonk/learn/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import {
  type TabMissionsReport,
  type TabMissionsReports,
  type TabMissionsScope,
  addTabMissionsReport,
  countTabMissions,
  findTabMissionsReport,
} from "./tab-missions";

const TabMissionsContext = createContext<{
  newest: TabMissionsReport | null;
  report: (read: TabMissionsReport) => void;
} | null>(null);

function useTabMissionsScope(): TabMissionsScope | null {
  const learner = useLearnerSummary();

  if (learner.status !== "ready" || !learner.summary.day) {
    return null;
  }

  return { day: learner.summary.day, learnerId: learner.summary.identity.userId };
}

/**
 * The frame keeps its summary between pages, but pages read the missions again after every answer.
 * A read counts only for its own learner and study day, so a late one never shows on another.
 */
export function TabMissionsProvider({ children }: { children: React.ReactNode }) {
  const scope = useTabMissionsScope();
  const [reports, setReports] = useState<TabMissionsReports>({});

  const report = useCallback((read: TabMissionsReport) => {
    setReports((current) => addTabMissionsReport(current, read));
  }, []);

  const newest = findTabMissionsReport({ reports, scope });
  const value = useMemo(() => ({ newest, report }), [newest, report]);

  return <TabMissionsContext value={value}>{children}</TabMissionsContext>;
}

export function useReportTabMissions({
  day,
  missions,
  readAt,
  userId,
}: {
  day: LearnerSummaryDay | null;
  missions: readonly Pick<Mission, "status">[] | null;
  readAt: number;
  userId: string;
}) {
  const report = use(TabMissionsContext)?.report;
  const count = countTabMissions(missions);
  const done = count?.done;
  const total = count?.total;
  const goalId = day?.goalId;
  const localDate = day?.localDate;

  useEffect(() => {
    if (goalId === undefined || localDate === undefined) {
      return;
    }

    report?.({
      day: { goalId, localDate },
      missions: done === undefined || total === undefined ? null : { done, total },
      readAt,
      userId,
    });
  }, [done, goalId, localDate, readAt, report, total, userId]);
}

/** A read at the same moment is the page's, which runs after Today builds the day's session. */
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
