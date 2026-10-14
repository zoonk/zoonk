"use client";

import { usePathname } from "@/i18n/navigation";
import { type LearnerBuddy } from "@/lib/learn/learner-buddy";
import { useTabMissions } from "@/lib/learn/tab-missions-provider";
import { markAppEntry } from "@zoonk/learn/bar";
import { useGoalSwitchPending } from "@zoonk/learn/goal-switcher";
import {
  LearnBottomNavigation,
  LearnSideNavigation,
  type LearnTab,
  type LearnTabMissions,
} from "@zoonk/learn/navigation";
import { LearnShellMain } from "@zoonk/learn/shell";
import { cn } from "@zoonk/ui/lib/utils";
import { useSelectedLayoutSegments } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * The tab each page belongs to, by the first part of its path. Chapter and unit pages (under
 * `content`), subjects, the exam page with its mock chooser (`mock`) and the mind maps open from
 * the Plan; the mistakes notebook and a language goal's speaking practice from Today's "Practice
 * anytime" (and from the sidebar's own links).
 */
const TAB_PATHS: Record<string, LearnTab> = {
  buddy: "buddy",
  content: "journey",
  exam: "journey",
  "mind-maps": "journey",
  mistakes: "today",
  mock: "journey",
  plan: "journey",
  speaking: "today",
  today: "today",
};

/** The tabs' own pages, where the app bar (goal, tabs, account) is the page's bar. */
const TAB_ROOTS = new Set<string>(["buddy", "plan", "today"]);

/**
 * Pages with their own link in the sidebar, which marks that link instead of a tab: the mock
 * chooser marks the exam's.
 */
const SIDEBAR_PATHS = new Set<string>(["exam", "mind-maps", "mistakes", "mock", "speaking"]);

/** Onboarding's screens: a new goal's questions, a course's start and the placement mock's chooser. */
function useIsOnboarding(): boolean {
  return useSelectedLayoutSegments().includes("(onboarding)");
}

/**
 * By the path, not the layout's segment: a pushed page belongs to the tab it opens from. In the
 * sidebar, a page with its own link there marks that link, not its tab. Onboarding (a new goal's
 * screens, a course's start, the placement mock's chooser) is none of the tabs' pages: it marks
 * none, as the catalog and settings don't.
 */
function useActiveTab({ sidebar = false }: { sidebar?: boolean } = {}): LearnTab | null {
  const [, first = ""] = usePathname().split("/");
  const onboarding = useIsOnboarding();

  if (onboarding || (sidebar && SIDEBAR_PATHS.has(first))) {
    return null;
  }

  return TAB_PATHS[first] ?? null;
}

/** The frame's read of the buddy's tab, and when it ran (a page's newer read wins). */
type TabsProps = { buddy?: LearnerBuddy; missions?: LearnTabMissions; readAt?: number };

/** What's left of today, at the end of the sidebar's Today; it streams in on its own. */
type SideTabsProps = TabsProps & { todayCount?: React.ReactNode };

function CurrentSideTabs({ buddy, missions, todayCount }: SideTabsProps) {
  return (
    <LearnSideNavigation
      activeTab={useActiveTab({ sidebar: true })}
      buddy={buddy}
      missions={missions}
      todayCount={todayCount}
    />
  );
}

/**
 * Onboarding has no tab bar: until the plan exists the tabs would only lead to a half-made one, and
 * the screen's bar has its way back and out. From `lg` the sidebar stays, as every page's.
 */
function CurrentBottomTabs({ buddy, missions }: TabsProps) {
  const activeTab = useActiveTab();

  if (useIsOnboarding()) {
    return null;
  }

  return <LearnBottomNavigation activeTab={activeTab} buddy={buddy} missions={missions} />;
}

/**
 * An onboarding screen hides the first paint's copy of the tab bar, the way a page with its own
 * bar hides the top bar's (see `TabRootOnly`). `contents` keeps the bar sticky to the frame.
 */
const ONBOARDING_FIRST_PAINT_CLASS =
  "contents [[data-slot=learn-shell-content]:has([data-onboarding-bar])_&]:hidden";

/**
 * The tabs in the sidebar from `lg` up, with the current page's tab marked. The path of a page
 * with its own id (a subject, a chapter) is only known once the page is open, so until then the
 * tabs are drawn without the mark, in the same place.
 */
export function LearnSideTabs({ buddy, todayCount, ...read }: SideTabsProps) {
  const missions = useTabMissions(read);

  return (
    <Suspense
      fallback={
        <LearnSideNavigation
          activeTab={null}
          buddy={buddy}
          missions={missions}
          todayCount={todayCount}
        />
      }
    >
      <CurrentSideTabs buddy={buddy} missions={missions} todayCount={todayCount} />
    </Suspense>
  );
}

/**
 * The tab bar at the bottom of the screen under `lg`, with the current page's tab marked; none on
 * onboarding's screens.
 */
export function LearnBottomTabs({ buddy, ...read }: TabsProps) {
  const missions = useTabMissions(read);

  return (
    <Suspense
      fallback={
        <div className={ONBOARDING_FIRST_PAINT_CLASS}>
          <LearnBottomNavigation activeTab={null} buddy={buddy} missions={missions} />
        </div>
      }
    >
      <CurrentBottomTabs buddy={buddy} missions={missions} />
    </Suspense>
  );
}

/** Whether the page is one of the tabs' own (Today, the Plan, the buddy), by its path. */
export function useIsTabRoot(): boolean {
  const [, first = "", ...rest] = usePathname().split("/");
  return rest.length === 0 && TAB_ROOTS.has(first);
}

function TabRootContent({ children }: { children: React.ReactNode }) {
  return useIsTabRoot() ? children : null;
}

/**
 * A page with a bar of its own (a page's or a section's), which hides the first paint's copy of
 * the top bar (see `TabRootOnly`).
 */
const OWN_BAR_FIRST_PAINT_CLASS =
  "[[data-slot=learn-shell-content]:has([data-slot=learn-page-bar],[data-slot=learn-section-bar])_&]:hidden";

/**
 * The top bar belongs to the tabs' own pages under `lg`. A page opened from a tab (a chapter, a
 * subject, the exam) has its own bar in its place, with the way back and its actions. A page whose
 * path is only known once it's open has its own id, so it's never a tab's own page.
 *
 * The path is read after the page's first paint (its static shell), so until then the bar is
 * drawn anyway: a tab's own page then never moves down when the bar comes, as it did by 110px on
 * every load on a phone. A page with its own bar hides that copy. The first paint's copies (this
 * one and the tab bar's) are the only places the frame reads the page with `:has()`: only the
 * first paint has them, before the router keeps any other page hidden in the document.
 */
export function TabRootOnly({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className={OWN_BAR_FIRST_PAINT_CLASS}>{children}</div>}>
      <TabRootContent>{children}</TabRootContent>
    </Suspense>
  );
}

/**
 * Sections leave as a whole; the learning tabs and their pages keep their own history. Onboarding
 * is one too: its way out skips its own screens (`/start`, a goal's questions), which would only
 * lead back into it.
 */
const APP_SECTIONS = new Set(["(settings)", "(stats)", "(catalog)", "(onboarding)"]);

function MarkAppEntry() {
  const pathname = usePathname();
  const section = useSelectedLayoutSegments().find((segment) => APP_SECTIONS.has(segment));

  useEffect(() => {
    markAppEntry(section);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Each page is a new history entry to mark.
  }, [pathname, section]);

  return null;
}

/**
 * Marks each of the app's pages in the browser's history, so leaving a section (settings,
 * statistics, the catalog) returns to the page the learner left for it.
 */
export function AppPageHistory() {
  return (
    <Suspense fallback={null}>
      <MarkAppEntry />
    </Suspense>
  );
}

/**
 * The page's frame, which dims and stays out of reach while a goal switch is on its way: the page
 * still shows the previous goal's day until the new one's renders.
 */
export function LearnFrameMain({ children }: { children: React.ReactNode }) {
  const switching = useGoalSwitchPending();

  return (
    <LearnShellMain
      aria-busy={switching || undefined}
      inert={switching}
      className={cn(
        "transition-opacity duration-150 motion-reduce:transition-none",
        switching && "pointer-events-none opacity-60",
      )}
    >
      {children}
    </LearnShellMain>
  );
}
