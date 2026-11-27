import { CommandPaletteScope } from "@/app/[lang]/app-command-palette";
import { UsageDataNotice } from "@/app/[lang]/usage-data-notice";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { LearnerSeedChannel } from "@/components/learner/learner-seed-provider";
import { VisitorBarLinks } from "@/components/login-bar-link";
import { TabMissionsProvider } from "@/lib/learn/tab-missions-provider";
import {
  FRAME_COLUMN_CLASS,
  LearnShell,
  LearnShellContent,
  LearnSkipLink,
} from "@zoonk/learn/shell";
import { LearnTabRootBar } from "@zoonk/learn/tab-root-bar";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { LearnBarEnd } from "./learn-bar-end";
import { LearnGoalMenu } from "./learn-goal-menu";
import { LearnAppSidebar } from "./learn-sidebar";
import { LearnBarSearch } from "./learn-sidebar-links";
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
      <LearnTabRootBar
        end={<LearnBarEnd visitor={<VisitorBarLinks />} />}
        start={<LearnGoalMenu visitor={<LearnBarSearch edge="start" />} />}
      />
    </TabRootOnly>
  );
}

/**
 * The frame's bar's height where a page's aside reaches up beside it: on a computer, where the bar
 * holds nothing and keeps only its 12px top room and hairline. The second rule is the first
 * paint's, before the path is known (`TabRootOnly`).
 */
const FRAME_BAR_VAR_CLASS = cn(
  "[--frame-bar:0px] [&:has(>[data-slot=learn-frame-bar])]:[--frame-bar:calc(0.75rem+1px)]",
  "[&:has(>div>[data-slot=learn-frame-bar]):not(:has([data-slot=learn-shell-main]_[data-slot=page-top-bar]))]:[--frame-bar:calc(0.75rem+1px)]",
);

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

            <LearnShellContent className={FRAME_BAR_VAR_CLASS}>
              <UsageDataNotice className={FRAME_COLUMN_CLASS} />
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
