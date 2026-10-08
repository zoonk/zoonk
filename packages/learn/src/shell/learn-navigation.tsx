"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { HouseIcon, RouteIcon, SmileIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { BuddyTabName } from "../buddies/buddy-labels";
import { type MissionsCount, MissionsRing } from "../buddies/missions-ring";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { LEARN_TABS, type LearnTab } from "./learn-tabs";

export type { LearnTab } from "./learn-tabs";

/** The learner's buddy, null before one is picked, undefined while it loads. */
type TabBuddy = LearnBuddy | null | undefined;

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
    return t("Journey");
  }

  if (buddy === undefined) {
    return (
      <>
        <Skeleton aria-hidden="true" className="inline-block h-3 w-10 align-middle" />
        <span className="sr-only">{t("Buddy")}</span>
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
  sm: { face: "size-6", icon: "size-4", ring: "size-7", ringedFace: "size-5" },
} as const;

/**
 * Lucide icons for Today and Journey; the buddy's own face once there is one, wearing today's
 * missions as a ring, so they're in sight from every tab.
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
    return <HouseIcon aria-hidden="true" className={sizes.icon} />;
  }

  if (tab === "journey") {
    return <RouteIcon aria-hidden="true" className={sizes.icon} />;
  }

  if (buddy === undefined) {
    return <Skeleton className={cn("rounded-full", sizes.face)} />;
  }

  const face = buddy ? (
    <Buddy
      beltColor={buddy.beltColor}
      className={faceClass}
      crop="face"
      energy={buddy.energy}
      glasses={buddy.glasses}
      kind={buddy.kind}
      studiedToday={buddy.studiedToday}
    />
  ) : (
    <SmileIcon aria-hidden="true" className={sizes.icon} />
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
 * Both bars mark the current tab the same way: the whole item (icon and label) sits on a soft
 * pill in full contrast, so it reads at a glance; black stays for the page's main action.
 */
const TAB_ITEM_CLASS =
  "focus-visible:ring-ring/50 text-muted-foreground hover:bg-foreground/5 hover:text-foreground aria-[current=page]:bg-foreground/10 aria-[current=page]:text-foreground font-medium outline-none transition-colors focus-visible:ring-[3px]";

/** The three tabs in the middle of the top bar from `lg` up. Place it inside `LearnShellHeader`. */
export function LearnTopNavigation({ activeTab, buddy, missions }: LearnNavigationProps) {
  const routes = useLearnRoutes();

  return (
    <NavigationRoot
      className="col-start-2 row-start-1 hidden justify-self-center lg:block"
      data-slot="learn-top-navigation"
    >
      <ul className="flex items-center gap-1">
        {LEARN_TABS.map((tab) => (
          <li key={tab}>
            <LearnLink
              aria-current={tab === activeTab ? "page" : undefined}
              className={cn(
                TAB_ITEM_CLASS,
                "hit-area relative flex h-10 max-w-48 items-center gap-2 rounded-full px-4 text-sm",
              )}
              href={routes[tab]}
            >
              <TabIcon buddy={buddy} missions={missions} size="sm" tab={tab} />
              <span className="min-w-0 truncate">
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
      className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      data-bottom-bar=""
      data-slot="learn-bottom-navigation"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3 gap-1 px-2 py-1.5">
        {LEARN_TABS.map((tab) => (
          <li className="flex" key={tab}>
            <LearnLink
              aria-current={tab === activeTab ? "page" : undefined}
              className={cn(
                TAB_ITEM_CLASS,
                "flex min-h-13 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-xs",
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
