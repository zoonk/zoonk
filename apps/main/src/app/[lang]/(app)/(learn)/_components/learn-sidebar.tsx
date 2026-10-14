import { LoginBarLink } from "@/components/login-bar-link";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import {
  LEARN_SIDEBAR_ITEM_CLASS,
  LearnSidebar,
  LearnSidebarFooter,
  LearnSidebarHeader,
  LearnSidebarSection,
} from "@zoonk/learn/shell";
import { getExtracted } from "next-intl/server";
import { LearnGoalMenu } from "./learn-goal-menu";
import { SidebarAccount, StudyLinks } from "./learn-sidebar-learner";
import { LearnSidebarLink, LearnSidebarSearch } from "./learn-sidebar-links";

/**
 * What the learner reaches from anywhere besides the tabs, the catalog last: it's every learner's
 * (and visitor's), so it never waits, and it's marked while the learner browses it.
 */
async function StudyShortcuts() {
  const t = await getExtracted();

  return (
    <LearnSidebarSection aria-label={t("Study")} label={t("Study")}>
      <StudyLinks />
      <LearnSidebarLink label={t("Explore courses")} menu="courses" />
    </LearnSidebarSection>
  );
}

/**
 * A visitor's foot of the sidebar: what Zoonk costs, as one of its rows (the public pricing page,
 * outside the frame, so never marked), then the way in.
 */
async function VisitorAccount() {
  const t = await getExtracted();
  const { icon: PricingIcon, url } = getMenu("pricing");

  return (
    <div className="flex flex-col gap-2">
      <Link className={LEARN_SIDEBAR_ITEM_CLASS} href={url}>
        <PricingIcon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{t("Pricing")}</span>
      </Link>
      <LoginBarLink className="w-full" variant="outline" />
    </div>
  );
}

/**
 * The learning app's navigation from `lg`: the goal switcher and search on top, the three tabs
 * (`tabs`), the study shortcuts, and the account at the end. Everything about the learner comes
 * from the learner summary in the browser, so the sidebar itself is the same for everyone.
 */
export async function LearnAppSidebar({ tabs }: { tabs: React.ReactNode }) {
  const t = await getExtracted();

  return (
    <LearnSidebar aria-label={t("Sidebar")} className="gap-4">
      <LearnSidebarHeader className="gap-4">
        <LearnGoalMenu placement="sidebar" />
        <LearnSidebarSearch />
      </LearnSidebarHeader>

      {tabs}

      <StudyShortcuts />

      <LearnSidebarFooter>
        <SidebarAccount visitor={<VisitorAccount />} />
      </LearnSidebarFooter>
    </LearnSidebar>
  );
}
