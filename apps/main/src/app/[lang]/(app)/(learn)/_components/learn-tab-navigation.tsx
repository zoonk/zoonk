"use client";

import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { usePathname } from "@/i18n/navigation";
import { useTabMissions } from "@/lib/learn/tab-missions-provider";
import { type LearnerSummaryState } from "@/lib/learner/learner-snapshot";
import { markAppEntry } from "@zoonk/learn/bar";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
import { useGoalSwitchPending } from "@zoonk/learn/goal-switcher";
import {
  LearnBottomNavigation,
  LearnSideNavigation,
  type LearnTab,
  type LearnTabMissions,
} from "@zoonk/learn/navigation";
import { LearnShellMain } from "@zoonk/learn/shell";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useSelectedLayoutSegments } from "next/navigation";
import { Suspense, useLayoutEffect } from "react";

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

const TAB_ROOTS = new Set<string>(["buddy", "plan", "today"]);

const SIDEBAR_PATHS = new Set<string>(["exam", "mind-maps", "mistakes", "mock", "speaking"]);

function useIsOnboarding(): boolean {
  return useSelectedLayoutSegments().includes("(onboarding)");
}

/** By the path, not the layout's segment: a pushed page belongs to the tab it opens from. */
function useActiveTab({ sidebar = false }: { sidebar?: boolean } = {}): LearnTab | null {
  const [, first = ""] = usePathname().split("/");
  const onboarding = useIsOnboarding();

  if (onboarding || (sidebar && SIDEBAR_PATHS.has(first))) {
    return null;
  }

  return TAB_PATHS[first] ?? null;
}

type TabsProps = { buddy?: LearnBuddy | null; missions?: LearnTabMissions };

function getSummaryTabs(learner: LearnerSummaryState) {
  if (learner.status === "ready") {
    const { buddy, missions, readAt } = learner.summary;
    return { buddy, missions, readAt };
  }

  if (learner.status === "visitor") {
    return { buddy: null, missions: null };
  }

  return {};
}

function useFrameTabs(learner: LearnerSummaryState): TabsProps {
  const { buddy, ...read } = getSummaryTabs(learner);
  return { buddy, missions: useTabMissions(read) };
}

const UNREAD: LearnerSummaryState = { status: "not-loaded" };

function TodayCount({ learner }: { learner: LearnerSummaryState }) {
  const t = useExtracted();
  const blocksLeft = learner.status === "ready" ? (learner.summary.today?.blocksLeft ?? 0) : 0;

  if (!blocksLeft) {
    return null;
  }

  return (
    <span className="text-faint in-aria-[current=page]:text-muted-foreground font-mono text-xs tabular-nums">
      <span aria-hidden="true">{blocksLeft}</span>
      <span className="sr-only">
        {t("{count, plural, one {# activity left} other {# activities left}}", {
          count: blocksLeft,
        })}
      </span>
    </span>
  );
}

type SideTabsProps = TabsProps & { todayCount: React.ReactNode };

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

/** Onboarding has no tab bar: until the plan exists the tabs would only lead to a half-made one. */
function CurrentBottomTabs({ buddy, missions }: TabsProps) {
  const activeTab = useActiveTab();

  if (useIsOnboarding()) {
    return null;
  }

  return <LearnBottomNavigation activeTab={activeTab} buddy={buddy} missions={missions} />;
}

/** `contents` keeps the bar sticky to the frame. */
const ONBOARDING_FIRST_PAINT_CLASS =
  "contents [[data-slot=learn-shell-content]:has([data-onboarding-bar])_&]:hidden";

/** A page with its own id has a path only known once it's open, so the tabs are unmarked until then. */
function SideTabs({ learner }: { learner: LearnerSummaryState }) {
  const { buddy, missions } = useFrameTabs(learner);
  const todayCount = <TodayCount learner={learner} />;

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

function FrameSideTabs() {
  return <SideTabs learner={useFrameLearner()} />;
}

export function LearnSideTabs() {
  return (
    <Suspense fallback={<SideTabs learner={UNREAD} />}>
      <FrameSideTabs />
    </Suspense>
  );
}

function BottomTabs({ learner }: { learner: LearnerSummaryState }) {
  const { buddy, missions } = useFrameTabs(learner);

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

function FrameBottomTabs() {
  return <BottomTabs learner={useFrameLearner()} />;
}

export function LearnBottomTabs() {
  return (
    <Suspense fallback={<BottomTabs learner={UNREAD} />}>
      <FrameBottomTabs />
    </Suspense>
  );
}

export function useIsTabRoot(): boolean {
  const [, first = "", ...rest] = usePathname().split("/");
  return rest.length === 0 && TAB_ROOTS.has(first);
}

function TabRootContent({ children }: { children: React.ReactNode }) {
  return useIsTabRoot() ? children : null;
}

const OWN_BAR_FIRST_PAINT_CLASS =
  "[[data-slot=learn-shell-content]:has([data-slot=learn-page-bar],[data-slot=learn-section-bar])_&]:hidden";

/**
 * The path is read after the first paint, so the bar is drawn until then and a tab's own page never
 * moves down when it comes. Only the first paint's copy reads the page with `:has()`: before it, the
 * router keeps no other page hidden in the document.
 */
export function TabRootOnly({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className={OWN_BAR_FIRST_PAINT_CLASS}>{children}</div>}>
      <TabRootContent>{children}</TabRootContent>
    </Suspense>
  );
}

/** Sections leave as a whole; onboarding's way out skips its own screens, which would only lead back into it. */
const APP_SECTIONS = new Set(["(settings)", "(stats)", "(catalog)", "(onboarding)"]);

function MarkAppEntry() {
  const pathname = usePathname();
  const section = useSelectedLayoutSegments().find((segment) => APP_SECTIONS.has(segment));

  // In the commit that writes the page's history entry, so no tap finds the entry unmarked.
  useLayoutEffect(() => {
    markAppEntry(section);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Each page is a new history entry to mark.
  }, [pathname, section]);

  return null;
}

export function AppPageHistory() {
  return (
    <Suspense fallback={null}>
      <MarkAppEntry />
    </Suspense>
  );
}

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
