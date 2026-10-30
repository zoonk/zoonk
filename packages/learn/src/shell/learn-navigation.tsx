"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { SIDEBAR_ITEM_CLASS } from "@zoonk/ui/components/sidebar";
import { cn } from "@zoonk/ui/lib/utils";
import { MapIcon, SunIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { BuddyTabName } from "../buddies/buddy-labels";
import { type MissionsCount, MissionsRing } from "../buddies/missions-ring";
import { type LearnBuddy, resolveLearnBuddy } from "../buddies/use-buddy-name";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { LEARN_TABS, type LearnTab } from "./learn-tabs";

export type { LearnTab } from "./learn-tabs";

/**
 * Undefined while it loads: the default buddy stays invisible on a page marked signed in, so
 * another buddy never shows before the learner's own.
 */
type TabBuddy = LearnBuddy | null | undefined;

const LOADING_BUDDY_CLASS = "signed-in:invisible";

export type LearnTabMissions = MissionsCount | null;

type LearnNavigationProps = {
  activeTab: LearnTab | null;
  buddy?: TabBuddy;
  missions?: LearnTabMissions;
};

function TabLabel({ buddy, tab }: { buddy: TabBuddy; tab: LearnTab }) {
  const t = useExtracted();

  if (tab === "today") {
    return t("Today");
  }

  if (tab === "journey") {
    return t("Plan");
  }

  if (buddy === undefined) {
    return (
      <>
        <span className={LOADING_BUDDY_CLASS}>
          <BuddyTabName buddy={null} />
        </span>
        <span className="signed-in:inline sr-only hidden">{t("Buddy")}</span>
      </>
    );
  }

  return <BuddyTabName buddy={buddy} />;
}

function MissionsLabel({ missions }: { missions: MissionsCount }) {
  const t = useExtracted();

  return (
    <span className="sr-only">
      {t(
        "{done, plural, =0 {# of {total} missions today} one {# of {total} missions today} other {# of {total} missions today}}",
        { done: missions.done, total: String(missions.total) },
      )}
    </span>
  );
}

const GLYPH_SIZES = {
  md: { face: "size-7", icon: "size-5", ring: "size-8", ringedFace: "size-6" },
  sm: { face: "size-5", icon: "size-4", ring: "size-6", ringedFace: "size-4" },
} as const;

function TabIcon({
  buddy,
  missions,
  size,
  tab,
}: {
  buddy: TabBuddy;
  missions?: LearnTabMissions;
  size: "md" | "sm";
  tab: LearnTab;
}) {
  const sizes = GLYPH_SIZES[size];
  const ringed = tab === "buddy" && Boolean(missions);
  const faceClass = ringed ? sizes.ringedFace : sizes.face;

  if (tab === "today") {
    return <SunIcon aria-hidden="true" className={sizes.icon} />;
  }

  if (tab === "journey") {
    return <MapIcon aria-hidden="true" className={sizes.icon} />;
  }

  const resolved = resolveLearnBuddy(buddy ?? null);

  const face = (
    <Buddy
      beltColor={resolved.beltColor}
      className={cn(faceClass, buddy === undefined && LOADING_BUDDY_CLASS)}
      crop="face"
      energy={resolved.energy}
      glasses={resolved.glasses}
      kind={resolved.kind}
      studiedToday={resolved.studiedToday}
    />
  );

  if (!missions) {
    return face;
  }

  return (
    <MissionsRing className={sizes.ring} missions={missions}>
      {face}
    </MissionsRing>
  );
}

function NavigationRoot({ ...props }: React.ComponentProps<"nav">) {
  const t = useExtracted();
  return <nav aria-label={t("Learning tabs")} {...props} />;
}

/**
 * A tapped tab whose page is still on its way (its link marked `data-link-pending`) takes the mark
 * at once.
 */
const TAB_ITEM_CLASS =
  "focus-visible:ring-ring/50 text-muted-foreground hover:bg-foreground/5 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground has-data-link-pending:bg-muted has-data-link-pending:text-foreground press font-medium outline-none focus-visible:ring-[3px]";

const SIDE_TAB_ITEM_CLASS = cn(
  SIDEBAR_ITEM_CLASS,
  "has-data-link-pending:bg-sidebar-accent has-data-link-pending:text-foreground",
);

const PENDING_NAVIGATION_CLASS =
  "[&:has([data-link-pending])_[aria-current=page]]:bg-transparent [&:has([data-link-pending])_[aria-current=page]]:text-muted-foreground";

/** Place it inside `Sidebar`. */
export function LearnSideNavigation({
  activeTab,
  buddy,
  missions,
  todayCount,
}: LearnNavigationProps & { todayCount?: React.ReactNode }) {
  const routes = useLearnRoutes();

  return (
    <NavigationRoot className={PENDING_NAVIGATION_CLASS} data-slot="learn-side-navigation">
      <ul className="flex flex-col gap-0.5">
        {LEARN_TABS.map((tab) => (
          <li key={tab}>
            <LearnLink
              aria-current={tab === activeTab ? "page" : undefined}
              className={SIDE_TAB_ITEM_CLASS}
              href={routes[tab]}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                <TabIcon buddy={buddy} missions={missions} size="sm" tab={tab} />
              </span>
              <span className="min-w-0 flex-1 truncate">
                <TabLabel buddy={buddy} tab={tab} />
              </span>
              {tab === "buddy" && missions && <MissionsLabel missions={missions} />}
              {tab === "today" && todayCount}
            </LearnLink>
          </li>
        ))}
      </ul>
    </NavigationRoot>
  );
}

/**
 * The bar's hairline, its padding around its 52px tabs, and the home indicator's inset: change it
 * with the bar.
 */
export const ABOVE_BOTTOM_TABS_CLASS = "bottom-[calc(4rem+1px+env(safe-area-inset-bottom))]";

/** Place it after `LearnShellMain`; toasts rise above it (`data-bottom-bar`). */
export function LearnBottomNavigation({ activeTab, buddy, missions }: LearnNavigationProps) {
  const routes = useLearnRoutes();

  return (
    <NavigationRoot
      className={cn(
        "bg-background sticky bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] lg:hidden",
        PENDING_NAVIGATION_CLASS,
      )}
      data-bottom-bar=""
      data-slot="learn-bottom-navigation"
    >
      <ul className="mx-auto flex justify-around px-4 py-1.5 sm:max-w-3xl sm:px-8">
        {LEARN_TABS.map((tab) => (
          <li className="flex" key={tab}>
            <LearnLink
              aria-current={tab === activeTab ? "page" : undefined}
              className={cn(
                TAB_ITEM_CLASS,
                "flex min-h-13 w-18 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.625rem] px-1 text-[0.6875rem]",
              )}
              href={routes[tab]}
            >
              <span className="flex h-7 items-center justify-center">
                <TabIcon buddy={buddy} missions={missions} size="md" tab={tab} />
              </span>
              <span className="max-w-full truncate">
                <TabLabel buddy={buddy} tab={tab} />
              </span>
              {tab === "buddy" && missions && <MissionsLabel missions={missions} />}
            </LearnLink>
          </li>
        ))}
      </ul>
    </NavigationRoot>
  );
}
