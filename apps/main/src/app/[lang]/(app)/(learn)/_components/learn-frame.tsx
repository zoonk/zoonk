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

async function SkipToContent() {
  const t = await getExtracted();
  return <LearnSkipLink>{t("Skip to content")}</LearnSkipLink>;
}

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
 * The learner comes from the learner summary: a private section reads it with the page, so a hard
 * load paints it with the page. The static shell and every prefetch draw the neutral look until then.
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
