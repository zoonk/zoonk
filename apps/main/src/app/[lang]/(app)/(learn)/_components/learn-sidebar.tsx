import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { VisitorStartButton } from "@/components/public/visitor-start";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarHeaderRow,
} from "@zoonk/ui/components/sidebar";
import { SidebarToggle, SidebarTooltip } from "@zoonk/ui/components/sidebar-toggle";
import { cn } from "@zoonk/ui/lib/utils";
import { LogInIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { LearnGoalMenu } from "./learn-goal-menu";
import { LearnerSections, SidebarAccount } from "./learn-sidebar-learner";
import { LearnSidebarFeedback, LearnSidebarSearch } from "./learn-sidebar-links";

async function VisitorAccount() {
  const t = await getExtracted();

  return (
    <div className="flex flex-col gap-2">
      <VisitorStartButton />

      <SidebarTooltip label={t("Log in")}>
        <CurrentPageLoginLink
          className={cn(
            buttonVariants({ variant: "outline" }),
            "sidebar-collapsed:my-1 sidebar-collapsed:size-8 sidebar-collapsed:p-0! w-full",
          )}
          icon={<LogInIcon aria-hidden="true" />}
        >
          <span className="sidebar-collapsed:sr-only">{t("Log in")}</span>
        </CurrentPageLoginLink>
      </SidebarTooltip>
    </div>
  );
}

/** Everything about the learner comes from the learner summary, so the sidebar itself is the same for everyone. */
export async function LearnAppSidebar({ tabs }: { tabs: React.ReactNode }) {
  const t = await getExtracted();

  return (
    <Sidebar aria-label={t("Sidebar")} className="gap-4">
      <SidebarHeader className="gap-4">
        {/* 44px, as tall as a page's bar, so the goal and the page's way back share a line. */}
        <SidebarHeaderRow className="min-h-11">
          <LearnGoalMenu placement="sidebar" />
          <SidebarToggle collapseLabel={t("Collapse sidebar")} expandLabel={t("Expand sidebar")} />
        </SidebarHeaderRow>
        <LearnSidebarSearch />
      </SidebarHeader>

      <SidebarBody className="gap-4">
        {tabs}
        <LearnerSections />
      </SidebarBody>

      <SidebarFooter>
        <LearnSidebarFeedback />
        <SidebarAccount visitor={<VisitorAccount />} />
      </SidebarFooter>
    </Sidebar>
  );
}
