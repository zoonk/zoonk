import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarHeaderRow,
} from "@zoonk/ui/components/sidebar";
import { SidebarToggle, SidebarTooltip } from "@zoonk/ui/components/sidebar-toggle";
import { cn } from "@zoonk/ui/lib/utils";
import { LogInIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { LearnGoalMenu } from "./learn-goal-menu";
import { SidebarAccount, StudySection } from "./learn-sidebar-learner";
import { LearnSidebarFeedback, LearnSidebarSearch } from "./learn-sidebar-links";

async function VisitorAccount() {
  const t = await getExtracted();

  return (
    <SidebarTooltip label={t("Log in")}>
      <CurrentPageLoginLink
        className={cn(
          buttonVariants({ size: "bar", variant: "outline" }),
          "sidebar-collapsed:my-1 sidebar-collapsed:size-8 sidebar-collapsed:p-0! w-full",
        )}
        icon={<LogInIcon aria-hidden="true" />}
      >
        <span className="sidebar-collapsed:sr-only">{t("Log in")}</span>
      </CurrentPageLoginLink>
    </SidebarTooltip>
  );
}

/** Everything about the learner comes from the learner summary, so the sidebar itself is the same for everyone. */
export async function LearnAppSidebar({ tabs }: { tabs: React.ReactNode }) {
  const t = await getExtracted();

  return (
    <Sidebar aria-label={t("Sidebar")} className="gap-4">
      <SidebarHeader className="gap-4">
        <SidebarHeaderRow>
          <LearnGoalMenu placement="sidebar" />
          <SidebarToggle collapseLabel={t("Collapse sidebar")} expandLabel={t("Expand sidebar")} />
        </SidebarHeaderRow>
        <LearnSidebarSearch />
      </SidebarHeader>

      {tabs}

      <StudySection />

      <SidebarFooter>
        <LearnSidebarFeedback />
        <SidebarAccount visitor={<VisitorAccount />} />
      </SidebarFooter>
    </Sidebar>
  );
}
