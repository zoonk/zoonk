import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { getLearnerBuddy, getTodayMissions } from "@/lib/learn/learner-buddy";
import { LearnBarProvider } from "@zoonk/learn/bar";
import { LearnShell, LearnShellHeader, LearnShellMain, LearnShellStart } from "@zoonk/learn/shell";
import { Suspense } from "react";
import { LearnBarEnd, LearnBarEndSkeleton } from "./learn-bar-end";
import { LearnGoalMenu, LearnGoalMenuSkeleton } from "./learn-goal-menu";
import { AppPageHistory, LearnBottomTabs, LearnTopTabs, TabRootOnly } from "./learn-tab-navigation";
import { VisitorCommandPalette } from "./visitor-command-palette";

/** The buddy's tab shows its face, its name and today's missions, so both placements read them. */
async function loadTabs() {
  const [buddy, missions] = await Promise.all([getLearnerBuddy(), getTodayMissions()]);
  return { buddy, missions };
}

async function TopTabs() {
  return <LearnTopTabs {...await loadTabs()} />;
}

async function BottomTabs() {
  return <LearnBottomTabs {...await loadTabs()} />;
}

/** While the buddy loads, Today and the Journey already work; only its tab waits. */
function TopTabsSlot() {
  return (
    <Suspense fallback={<LearnTopTabs />}>
      <TopTabs />
    </Suspense>
  );
}

/**
 * The tabs' own bar: the goal switcher on the left and the learner's level and account on the
 * right; from `lg` the tabs sit in the middle and the bar stays at the top while the page scrolls.
 * A page opened from a tab replaces it with its own bar (`LearnPageBar`).
 */
function LearnTopBar() {
  return (
    <TabRootOnly>
      <LearnShellHeader sticky>
        <LearnShellStart>
          <Suspense fallback={<LearnGoalMenuSkeleton />}>
            <LearnGoalMenu />
          </Suspense>
        </LearnShellStart>

        <TopTabsSlot />

        <Suspense fallback={<LearnBarEndSkeleton />}>
          <LearnBarEnd stats />
        </Suspense>
      </LearnShellHeader>
    </TabRootOnly>
  );
}

/**
 * The app's frame on the tabs and the pages opened from them: the top bar (the tabs' own, or the
 * page's), the page, and the tab bar at the bottom on phones and tablets. Sections (settings,
 * statistics, the catalog) have their own frame instead. Search has no button in the bar:
 * Cmd/Ctrl+K and the account menu open the command palette (the root layout's for anyone with a
 * session; a visitor's is mounted here).
 */
export function LearnFrame({ children }: { children: React.ReactNode }) {
  return (
    <MainLearnProvider>
      <LearnShell className="overflow-x-clip">
        <LearnTopBar />

        <LearnBarProvider tabs={<TopTabsSlot />}>
          <LearnShellMain>{children}</LearnShellMain>
        </LearnBarProvider>

        <Suspense fallback={<LearnBottomTabs />}>
          <BottomTabs />
        </Suspense>

        <AppPageHistory />

        <Suspense fallback={null}>
          <VisitorCommandPalette />
        </Suspense>
      </LearnShell>
    </MainLearnProvider>
  );
}
