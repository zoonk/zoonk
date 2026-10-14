import { UserAvatar } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar";
import { UserDropdownMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-dropdown-menu";
import { LoginBarLink } from "@/components/login-bar-link";
import { Link } from "@/i18n/navigation";
import { getBeltLabel } from "@/lib/belt-colors";
import { getMenu } from "@/lib/menu";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import {
  LEARN_SIDEBAR_ITEM_CLASS,
  LearnSidebar,
  LearnSidebarFooter,
  LearnSidebarHeader,
  LearnSidebarSection,
} from "@zoonk/learn/shell";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { DropdownMenu, DropdownMenuTrigger } from "@zoonk/ui/components/dropdown-menu";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { BeltLevel } from "./learn-bar-end";
import { LearnGoalMenu } from "./learn-goal-menu";
import { LearnSidebarLink, LearnSidebarSearch } from "./learn-sidebar-links";
import { getLearnerPlaces } from "./learner-places";

/**
 * The goal's places in its order: the mistakes notebook with how many are ready to practice, an exam's page, a
 * language goal's speaking paper and the mind maps when there are some, then the learner's
 * statistics.
 */
async function StudyLinks() {
  const t = await getExtracted();
  const places = await getLearnerPlaces();

  return (
    <>
      <LearnSidebarLink
        count={places.readyMistakes}
        label={t("Mistakes notebook")}
        menu="mistakes"
      />
      {places.exam && <LearnSidebarLink label={t("Exam")} menu="exam" />}
      {places.speaking && <LearnSidebarLink label={t("Speaking")} menu="speaking" />}
      {places.mindMaps && <LearnSidebarLink label={t("Mind maps")} menu="mindMaps" />}
      <LearnSidebarLink label={t("Statistics")} menu="stats" />
    </>
  );
}

/**
 * What the learner reaches from anywhere besides the tabs, the catalog last: it's every learner's
 * (and visitor's), so it never waits, and it's marked while the learner browses it. Until the
 * goal's own places are read, the two every learner has stand in their places.
 */
async function StudyShortcuts() {
  const t = await getExtracted();

  return (
    <LearnSidebarSection aria-label={t("Study")} label={t("Study")}>
      <Suspense
        fallback={
          <>
            <LearnSidebarLink label={t("Mistakes notebook")} menu="mistakes" />
            <LearnSidebarLink label={t("Statistics")} menu="stats" />
          </>
        }
      >
        <StudyLinks />
      </Suspense>
      <LearnSidebarLink label={t("Explore courses")} menu="courses" />
    </LearnSidebarSection>
  );
}

/**
 * The account row: the sidebar wide and 44px tall, so the whole row is one target, on the
 * sidebar's soft fill while hovered or open.
 */
const ACCOUNT_ROW_CLASS =
  "hover:bg-sidebar-accent/70 aria-expanded:bg-sidebar-accent focus-visible:ring-ring/50 flex h-11 w-full min-w-0 items-center gap-2.5 rounded-md px-1 text-left text-[0.84375rem] font-medium transition-colors outline-none focus-visible:ring-[3px]";

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
 * The sidebar's end: one row that opens the account's menu, with whose it is (the 24px avatar and
 * the learner's name, or "Guest" for someone studying without an account yet) and their belt and
 * level, which the menu's Statistics opens. Its name says all three, the visible name first. A
 * visitor's Pricing and way in instead.
 */
async function SidebarAccount() {
  const [session, level] = await Promise.all([getSession(), getBeltLevel()]);

  if (!session) {
    return <VisitorAccount />;
  }

  const t = await getExtracted();
  const name = session.user.isAnonymous ? t("Guest") : session.user.name || session.user.email;

  const belt = level
    ? {
        color: level.color,
        label: await getBeltLabel({ color: level.color }),
        level: String(level.level),
      }
    : null;

  const label = [
    name,
    belt ? t("{belt}, level {level}", { belt: belt.label, level: belt.level }) : null,
    t("User menu"),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} className={ACCOUNT_ROW_CLASS}>
        <span aria-hidden="true" className="flex size-6 shrink-0 overflow-hidden rounded-full">
          <UserAvatar />
        </span>
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {belt && (
          <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 pr-1 font-mono text-xs font-normal tabular-nums">
            <BeltLevel belt={belt.label} color={belt.color} level={belt.level} />
          </span>
        )}
      </DropdownMenuTrigger>

      <UserDropdownMenu align="start" side="top" />
    </DropdownMenu>
  );
}

/** The account row's place while the session is read: the avatar and a bar for the name. */
function SidebarAccountSkeleton() {
  return (
    <div className="flex h-11 w-full items-center gap-2.5 px-1">
      <AvatarSkeleton className="size-6" />
      <Skeleton className="h-3.5 w-24 rounded-sm" />
    </div>
  );
}

/**
 * The learning app's navigation from `lg`: the goal switcher and search on top, the three tabs
 * (`tabs`), the study shortcuts, and the account at the end.
 */
export async function LearnAppSidebar({ tabs }: { tabs: React.ReactNode }) {
  const t = await getExtracted();

  return (
    <LearnSidebar aria-label={t("Sidebar")} className="gap-4">
      <LearnSidebarHeader className="gap-4">
        <Suspense fallback={<Skeleton className="h-8 w-full rounded-md" />}>
          <LearnGoalMenu placement="sidebar" />
        </Suspense>
        <LearnSidebarSearch />
      </LearnSidebarHeader>

      {tabs}

      <StudyShortcuts />

      <LearnSidebarFooter>
        <Suspense fallback={<SidebarAccountSkeleton />}>
          <SidebarAccount />
        </Suspense>
      </LearnSidebarFooter>
    </LearnSidebar>
  );
}
