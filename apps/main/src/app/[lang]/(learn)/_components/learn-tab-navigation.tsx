"use client";

import { usePathname } from "@/i18n/navigation";
import { type LearnerBuddy } from "@/lib/learn/learner-buddy";
import { markAppEntry } from "@zoonk/learn/bar";
import {
  LearnBottomNavigation,
  type LearnTab,
  type LearnTabMissions,
  LearnTopNavigation,
} from "@zoonk/learn/navigation";
import { useSelectedLayoutSegments } from "next/navigation";
import { useEffect } from "react";

/**
 * The tab each page belongs to, by the first part of its path. Chapter and unit pages (under
 * `content`), subjects, the exam page and the mind maps open from the Journey; the mistakes
 * notebook from Today's "Practice anytime".
 */
const TAB_PATHS: Record<string, LearnTab> = {
  buddy: "buddy",
  content: "journey",
  exam: "journey",
  journey: "journey",
  "mind-maps": "journey",
  mistakes: "today",
  today: "today",
};

/** The tabs' own pages, where the app bar (goal, tabs, account) is the page's bar. */
const TAB_ROOTS = new Set<string>(["buddy", "journey", "today"]);

/**
 * By the path, not the layout's segment: a pushed page draws the tabs inside its own bar, below
 * this layout, where the segment would be the page's.
 */
function useActiveTab(): LearnTab | null {
  const [, first = ""] = usePathname().split("/");
  return TAB_PATHS[first] ?? null;
}

type TabsProps = { buddy?: LearnerBuddy; missions?: LearnTabMissions };

/** The tabs in the top bar from `lg` up, with the current page's tab marked. */
export function LearnTopTabs({ buddy, missions }: TabsProps) {
  return <LearnTopNavigation activeTab={useActiveTab()} buddy={buddy} missions={missions} />;
}

/** The tab bar at the bottom of the screen under `lg`, with the current page's tab marked. */
export function LearnBottomTabs({ buddy, missions }: TabsProps) {
  return <LearnBottomNavigation activeTab={useActiveTab()} buddy={buddy} missions={missions} />;
}

/** Whether the page is one of the tabs' own (Today, the Journey, the buddy). */
export function useIsTabRoot(): boolean {
  const segments = useSelectedLayoutSegments();
  const [first = ""] = segments;

  return segments.length === 1 && TAB_ROOTS.has(first);
}

/**
 * The app bar belongs to the tabs' own pages. A page opened from a tab (a chapter, a subject, the
 * exam) has its own bar in its place, with the way back and its actions.
 */
export function TabRootOnly({ children }: { children: React.ReactNode }) {
  return useIsTabRoot() ? children : null;
}

/**
 * Marks each of the app's pages in the browser's history, so leaving a section (settings,
 * statistics, the catalog) returns to the page the learner left for it.
 */
export function AppPageHistory() {
  const pathname = usePathname();

  useEffect(() => {
    markAppEntry();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Each page is a new history entry to mark.
  }, [pathname]);

  return null;
}
