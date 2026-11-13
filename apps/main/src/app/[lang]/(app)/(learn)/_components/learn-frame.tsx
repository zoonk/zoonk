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
import { PageTopBar } from "@zoonk/ui/components/page-top";
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

/** From `lg` the sidebar holds the goal, search and the account, and the bar stays as room. */
function PhoneOnly({ children }: { children: React.ReactNode }) {
  return <div className="contents lg:hidden">{children}</div>;
}

/**
 * A tab's own page (Today, Plan, the buddy) has the frame's bar; a pushed page draws its own. In
 * its own column, so it scrolls away with the page.
 */
function LearnTopBar() {
  return (
    <TabRootOnly>
      <div className={FRAME_COLUMN_CLASS} data-slot="learn-frame-bar">
        <PageTopBar
          actions={
            <PhoneOnly>
              <LearnBarEnd search={<LearnBarSearch />} visitor={<VisitorBarLinks />} />
            </PhoneOnly>
          }
          back={
            <PhoneOnly>
              <LearnGoalMenu visitor={<LearnBarSearch edge="start" />} />
            </PhoneOnly>
          }
        />
      </div>
    </TabRootOnly>
  );
}

/**
 * The frame's bar is `PageTopBar`'s height; a page's aside reaches up beside it. The second rule is
 * the first paint's, before the path is known (`TabRootOnly`).
 */
const FRAME_BAR_VAR_CLASS = cn(
  "[--frame-bar:0px] [&:has(>[data-slot=learn-frame-bar])]:[--frame-bar:calc(4rem+1px)]",
  "[&:has(>div>[data-slot=learn-frame-bar]):not(:has([data-slot=learn-shell-main]_[data-slot=page-top-bar]))]:[--frame-bar:calc(4rem+1px)]",
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
