import { CommandPaletteScope } from "@/app/[lang]/app-command-palette";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { LearnerSeedChannel } from "@/components/learner/learner-seed-provider";
import { VisitorBarLinks } from "@/components/login-bar-link";
import { TabMissionsProvider } from "@/lib/learn/tab-missions-provider";
import {
  LearnShell,
  LearnShellContent,
  LearnShellHeader,
  LearnShellStart,
  LearnSkipLink,
} from "@zoonk/learn/shell";
import { getExtracted } from "next-intl/server";
import { LearnBarEnd } from "./learn-bar-end";
import { LearnGoalMenu } from "./learn-goal-menu";
import { LearnAppSidebar } from "./learn-sidebar";
import { LearnSidebarSearch } from "./learn-sidebar-links";
import {
  AppPageHistory,
  LearnBottomTabs,
  LearnFrameMain,
  LearnSideTabs,
  TabRootOnly,
} from "./learn-tab-navigation";

/** The keyboard's way past the frame to the page, its first stop. */
async function SkipToContent() {
  const t = await getExtracted();
  return <LearnSkipLink>{t("Skip to content")}</LearnSkipLink>;
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
          <LearnGoalMenu />
        </LearnShellStart>

        <LearnBarEnd visitor={<VisitorBarLinks />} />

        <LearnSidebarSearch className="col-span-2 mt-1.5" placement="bar" />
      </LearnShellHeader>
    </TabRootOnly>
  );
}

/**
 * The app's frame around every page of the app (`(app)/layout.tsx`): from `lg` the sidebar (goal,
 * search, tabs, study shortcuts and account) beside the page; under `lg` the top bar (the tabs'
 * own, or the page's or section's), the page and the tab bar at the bottom. Cmd/Ctrl+K opens the
 * command palette everywhere (the root layout's; a visitor's in the frame only).
 *
 * What it shows about the learner (their goals, buddy, day, places and account) comes from the
 * learner summary: a private section reads it with the page as the learner enters it
 * (`LearnerSummarySeed`), so a hard load paints it with the page, and the browser keeps it current.
 * The static shell, every prefetch and the catalog, which stays static, draw the frame's neutral
 * look until the browser has it.
 */
export function LearnFrame({ children }: { children: React.ReactNode }) {
  return (
    <LearnerSeedChannel>
      <MainLearnProvider>
        <TabMissionsProvider>
          <LearnShell className="overflow-x-clip">
            <SkipToContent />
            <LearnAppSidebar tabs={<LearnSideTabs />} />

            <LearnShellContent>
              <LearnTopBar />
              <LearnFrameMain>{children}</LearnFrameMain>
              <LearnBottomTabs />
            </LearnShellContent>

            <AppPageHistory />
            <CommandPaletteScope />
          </LearnShell>
        </TabMissionsProvider>
      </MainLearnProvider>
    </LearnerSeedChannel>
  );
}
