import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { getLearnTabs } from "@/lib/learn/learner-buddy";
import { TabMissionsProvider } from "@/lib/learn/tab-missions-provider";
import {
  LearnShell,
  LearnShellContent,
  LearnShellHeader,
  LearnShellStart,
  LearnSkipLink,
} from "@zoonk/learn/shell";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnBarEnd, LearnBarEndSkeleton } from "./learn-bar-end";
import { LearnGoalMenu, LearnGoalMenuSkeleton } from "./learn-goal-menu";
import { LearnAppSidebar } from "./learn-sidebar";
import { LearnSidebarSearch } from "./learn-sidebar-links";
import {
  AppPageHistory,
  LearnBottomTabs,
  LearnFrameMain,
  LearnSideTabs,
  TabRootOnly,
} from "./learn-tab-navigation";
import { getTodayQueue } from "./learner-places";
import { VisitorCommandPalette } from "./visitor-command-palette";

/** What's left of today's session, in mono at the end of the sidebar's Today; nothing once done. */
async function TodayCount() {
  const queue = await getTodayQueue();

  if (!queue?.blocksLeft) {
    return null;
  }

  const t = await getExtracted();

  return (
    <span className="text-faint in-aria-[current=page]:text-muted-foreground font-mono text-xs tabular-nums">
      <span aria-hidden="true">{queue.blocksLeft}</span>
      <span className="sr-only">
        {t("{count, plural, one {# activity left} other {# activities left}}", {
          count: queue.blocksLeft,
        })}
      </span>
    </span>
  );
}

/** The keyboard's way past the frame to the page, its first stop. */
async function SkipToContent() {
  const t = await getExtracted();
  return <LearnSkipLink>{t("Skip to content")}</LearnSkipLink>;
}

/** The buddy's tab shows its face, its name and today's missions, so both placements read them. */
async function SideTabs() {
  return (
    <LearnSideTabs
      {...await getLearnTabs()}
      todayCount={
        <Suspense fallback={null}>
          <TodayCount />
        </Suspense>
      }
    />
  );
}

async function BottomTabs() {
  return <LearnBottomTabs {...await getLearnTabs()} />;
}

/**
 * The tabs' own bar under `lg`: the goal switcher on the left and the learner's level and account
 * on the right, with search under them. From `lg` the sidebar has them. A page opened from a tab
 * replaces it with its own bar (`LearnPageBar`).
 */
function LearnTopBar() {
  return (
    <TabRootOnly>
      <LearnShellHeader className="lg:hidden">
        <LearnShellStart>
          <Suspense fallback={<LearnGoalMenuSkeleton />}>
            <LearnGoalMenu />
          </Suspense>
        </LearnShellStart>

        <Suspense fallback={<LearnBarEndSkeleton />}>
          <LearnBarEnd stats />
        </Suspense>

        <LearnSidebarSearch className="col-span-2 mt-1.5" placement="bar" />
      </LearnShellHeader>
    </TabRootOnly>
  );
}

/**
 * The app's frame around every page of the app (`(app)/layout.tsx`): from `lg` the sidebar (goal,
 * search, tabs, study shortcuts and account) beside the page; under `lg` the top bar (the tabs'
 * own, or the page's or section's), the page and the tab bar at the bottom. Cmd/Ctrl+K opens the
 * command palette everywhere (the root layout's for anyone with a session; a visitor's is mounted
 * here).
 */
export function LearnFrame({ children }: { children: React.ReactNode }) {
  return (
    <MainLearnProvider>
      <TabMissionsProvider>
        <LearnShell className="overflow-x-clip">
          <SkipToContent />
          <LearnAppSidebar
            tabs={
              <Suspense fallback={<LearnSideTabs />}>
                <SideTabs />
              </Suspense>
            }
          />

          <LearnShellContent>
            <LearnTopBar />
            <LearnFrameMain>{children}</LearnFrameMain>

            <Suspense fallback={<LearnBottomTabs />}>
              <BottomTabs />
            </Suspense>
          </LearnShellContent>

          <AppPageHistory />

          <Suspense fallback={null}>
            <VisitorCommandPalette />
          </Suspense>
        </LearnShell>
      </TabMissionsProvider>
    </MainLearnProvider>
  );
}
