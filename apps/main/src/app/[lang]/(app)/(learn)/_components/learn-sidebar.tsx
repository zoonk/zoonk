import { LoginBarLink } from "@/components/login-bar-link";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import {
  SIDEBAR_ITEM_CLASS,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarSection,
} from "@zoonk/ui/components/sidebar";
import { getExtracted } from "next-intl/server";
import { LearnGoalMenu } from "./learn-goal-menu";
import { SidebarAccount, StudyLinks } from "./learn-sidebar-learner";
import { LearnSidebarSearch } from "./learn-sidebar-links";

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
      <Link className={SIDEBAR_ITEM_CLASS} href={url}>
        <PricingIcon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{t("Pricing")}</span>
      </Link>
      <LoginBarLink className="w-full" variant="outline" />
    </div>
  );
}

/** Everything about the learner comes from the learner summary, so the sidebar itself is the same for everyone. */
export async function LearnAppSidebar({ tabs }: { tabs: React.ReactNode }) {
  const t = await getExtracted();

  return (
    <Sidebar aria-label={t("Sidebar")} className="gap-4">
      <SidebarHeader className="gap-4">
        <LearnGoalMenu placement="sidebar" />
        <LearnSidebarSearch />
      </SidebarHeader>

      {tabs}

      <StudyShortcuts />

      <SidebarFooter>
        <SidebarAccount visitor={<VisitorAccount />} />
      </SidebarFooter>
    </Sidebar>
  );
}
