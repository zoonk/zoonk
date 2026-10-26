"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { MapIcon, SunIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { BuddyTabName } from "../buddies/buddy-labels";
import { type MissionsCount, MissionsRing } from "../buddies/missions-ring";
import { type LearnBuddy, resolveLearnBuddy } from "../buddies/use-buddy-name";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { LEARN_SIDEBAR_ITEM_CLASS } from "./learn-shell";
import { LEARN_TABS, type LearnTab } from "./learn-tabs";

export type { LearnTab } from "./learn-tabs";

/**
 * The learner's buddy, null for a host without a profile, undefined while it loads: until then the
 * tab has a visitor's default buddy, its face and name kept invisible on a page the host marked
 * signed in (`signed-in:`), so a learner's own buddy never follows another.
 */
type TabBuddy = LearnBuddy | null | undefined;

/**
 * The buddy's face and name while it loads, invisible on a page marked signed in, where the tab is
 * called "Buddy" instead until the learner's own is known.
 */
const LOADING_BUDDY_CLASS = "signed-in:invisible";

/** Today's missions, which ring the buddy's tab; null before today's session exists. */
export type LearnTabMissions = MissionsCount | null;

type LearnNavigationProps = {
  /** The tab the current route belongs to; null outside the tabs. */
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

/** Said with the buddy's tab, since its ring only shows the missions. */
function MissionsLabel({ missions }: { missions: MissionsCount }) {
  const t = useExtracted();

  return (
    <span className="sr-only">
      {t("{done} of {total} missions today", {
        done: String(missions.done),
        total: String(missions.total),
      })}
    </span>
  );
}

/** Icon and face sizes per bar, a step smaller inside the missions ring so it has room. */
const GLYPH_SIZES = {
  md: { face: "size-7", icon: "size-5", ring: "size-8", ringedFace: "size-6" },
  sm: { face: "size-5", icon: "size-4", ring: "size-6", ringedFace: "size-4" },
} as const;

/**
 * Lucide icons for Today (the sun) and the Plan (the map); the buddy's own face once there is one,
 * wearing today's missions as a ring, so they're in sight from every tab.
 */
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
 * Both placements mark the current tab the same way: the whole item (icon and label) sits on a
 * soft fill in full contrast, so it reads at a glance; black stays for the page's main action.
 */
const TAB_ITEM_CLASS =
  "focus-visible:ring-ring/50 text-muted-foreground hover:bg-foreground/5 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground font-medium transition-colors outline-none focus-visible:ring-[3px]";

/**
 * The three tabs in the sidebar from `lg` up, one under the other, the buddy's face wearing
 * today's missions and Today ending with what's left of the day (`todayCount`, the host's: it
 * streams in on its own). Place it inside `LearnSidebar`.
 */
export function LearnSideNavigation({
  activeTab,
  buddy,
  missions,
  todayCount,
}: LearnNavigationProps & { todayCount?: React.ReactNode }) {
  const routes = useLearnRoutes();

  return (
    <NavigationRoot data-slot="learn-side-navigation">
      <ul className="flex flex-col gap-0.5">
        {LEARN_TABS.map((tab) => (
          <li key={tab}>
            <LearnLink
              aria-current={tab === activeTab ? "page" : undefined}
              className={LEARN_SIDEBAR_ITEM_CLASS}
              href={routes[tab]}
            >
              {/* As wide as the study links' icons, so every row's icon and name line up; the
                  buddy's ringed face is a little wider and overflows it evenly. */}
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
 * How far above the screen's bottom something docked over the tab bar on a phone sits (Today's
 * action): the bar's hairline, its 6px padding above and below its 52px tabs, and the home
 * indicator's inset. Kept beside the bar so the two change together.
 */
export const ABOVE_BOTTOM_TABS_CLASS = "bottom-[calc(4rem+1px+env(safe-area-inset-bottom))]";

/**
 * The three tabs at the bottom of the screen under `lg`, where the thumb is. Place it after
 * `LearnShellMain`: it stays on screen while the page scrolls and takes its own room at the end,
 * so it never covers the page, and it clears the home indicator on iPhones. Toasts rise above it
 * (`data-bottom-bar`).
 */
export function LearnBottomNavigation({ activeTab, buddy, missions }: LearnNavigationProps) {
  const routes = useLearnRoutes();

  return (
    <NavigationRoot
      className="bg-background sticky bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
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
