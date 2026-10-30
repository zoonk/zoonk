import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  SIDEBAR_ITEM_CLASS,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarHeaderRow,
  SidebarSection,
} from "@zoonk/ui/components/sidebar";
import { SidebarToggle, SidebarTooltip } from "@zoonk/ui/components/sidebar-toggle";
import { cn } from "@zoonk/ui/lib/utils";
import { LogInIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { LearnGoalMenu } from "./learn-goal-menu";
import { SidebarAccount, StudyLinks } from "./learn-sidebar-learner";
import { LearnSidebarFeedback, LearnSidebarSearch } from "./learn-sidebar-links";

async function StudyShortcuts() {
  const t = await getExtracted();

  return (
    <SidebarSection aria-label={t("Study")} label={t("Study")}>
      <StudyLinks />
    </SidebarSection>
  );
}

async function VisitorAccount() {
  const t = await getExtracted();
  const { icon: PricingIcon, url } = getMenu("pricing");

  return (
    <div className="flex flex-col gap-2">
      <SidebarTooltip label={t("Pricing")}>
        <Link className={SIDEBAR_ITEM_CLASS} href={url}>
          <PricingIcon aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{t("Pricing")}</span>
        </Link>
      </SidebarTooltip>

      <SidebarTooltip label={t("Log in")}>
        <CurrentPageLoginLink
          className={cn(
            buttonVariants({ size: "bar", variant: "outline" }),
            "sidebar-collapsed:size-8 sidebar-collapsed:p-0 w-full",
          )}
        >
          <LogInIcon aria-hidden="true" className="sidebar-collapsed:block hidden" />
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
        <SidebarHeaderRow>
          <LearnGoalMenu placement="sidebar" />
          <SidebarToggle collapseLabel={t("Collapse sidebar")} expandLabel={t("Expand sidebar")} />
        </SidebarHeaderRow>
        <LearnSidebarSearch />
      </SidebarHeader>

      {tabs}

      <StudyShortcuts />

      <SidebarFooter>
        <LearnSidebarFeedback />
        <SidebarAccount visitor={<VisitorAccount />} />
      </SidebarFooter>
    </Sidebar>
  );
}
