"use client";

import { BusyIcon } from "@zoonk/ui/components/button";
import { SIDEBAR_ITEM_CLASS } from "@zoonk/ui/components/sidebar";
import { SidebarTooltip } from "@zoonk/ui/components/sidebar-toggle";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { MapIcon, SearchIcon, SunIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useAppLocale } from "../_utils/locale";
import { BuddyArt } from "../buddies/buddy-art";
import { BuddyTabName } from "../buddies/buddy-labels";
import { type MissionsCount, MissionsRing } from "../buddies/missions-ring";
import { type LearnBuddy } from "../buddies/use-buddy-name";
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
  renderBuddyPlaceholder?: (className: string) => React.ReactNode;
};

function TabLabel({
  buddy,
  renderBuddyPlaceholder,
  tab,
}: Pick<LearnNavigationProps, "buddy" | "renderBuddyPlaceholder"> & { tab: LearnTab }) {
  const t = useExtracted();

  if (tab === "today") {
    return t("Today");
  }

  if (tab === "journey") {
    return t("Plan");
  }

  if (buddy === undefined) {
    return (
      <span className="relative">
        <span className={LOADING_BUDDY_CLASS}>
          <BuddyTabName buddy={null} />
        </span>
        {renderBuddyPlaceholder?.(
          "signed-in:inline-block absolute start-0 top-1/2 hidden h-3 w-full -translate-y-1/2 rounded-sm",
        )}
        <span className="signed-in:inline sr-only hidden">{t("Buddy")}</span>
      </span>
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
  md: { face: "size-5", icon: "size-5", ring: "size-5 shrink-0", ringedFace: "size-4" },
  sm: { face: "size-4", icon: "size-4", ring: "size-4 shrink-0", ringedFace: "size-3" },
} as const;

function TabIcon({
  buddy,
  missions,
  renderBuddyPlaceholder,
  size,
  tab,
}: Pick<LearnNavigationProps, "buddy" | "missions" | "renderBuddyPlaceholder"> & {
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

  const face = (
    <BuddyArt
      buddy={buddy ?? null}
      className={cn(faceClass, buddy === undefined && LOADING_BUDDY_CLASS)}
      view="face"
    />
  );

  if (buddy === undefined) {
    return (
      <span className="relative">
        {face}
        {renderBuddyPlaceholder?.(
          cn("signed-in:block absolute inset-0 hidden rounded-full", faceClass),
        )}
      </span>
    );
  }

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
  const locale = useAppLocale();
  return <nav aria-label={t("Learning tabs")} lang={locale} {...props} />;
}

/**
 * A tapped tab whose page is still on its way (its link marked `data-link-pending`) takes the mark
 * at once.
 */
const TAB_ITEM_CLASS =
  "focus-visible:ring-ring/50 text-muted-foreground hover:bg-foreground/5 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground has-data-link-pending:bg-muted has-data-link-pending:text-foreground press font-medium outline-none focus-visible:ring-[3px]";

/**
 * Every item shares the bar's rows (room above, icon, title, room below), so the icons stay on one
 * row when a title wraps and each item's fill keeps its content in the middle.
 */
const BOTTOM_TAB_ITEM_CLASS = cn(
  TAB_ITEM_CLASS,
  "text-2xs row-span-4 grid min-w-0 grid-cols-1 grid-rows-subgrid content-center justify-items-center rounded-xl px-1 @max-xs/tabs:min-w-[44px]",
);

const BOTTOM_TAB_ICON_CLASS = "row-start-2 flex h-6 items-center justify-center";

const BOTTOM_TAB_TITLE_CLASS =
  "row-start-3 mt-0.5 max-w-full overflow-clip text-center text-balance hyphens-auto whitespace-nowrap [hyphenate-limit-chars:5_2_2] @max-xs/tabs:overflow-visible @max-xs/tabs:whitespace-normal";

const SIDE_TAB_ITEM_CLASS = cn(
  SIDEBAR_ITEM_CLASS,
  "has-data-link-pending:bg-muted has-data-link-pending:text-foreground",
);

const PENDING_NAVIGATION_CLASS =
  "[&:has([data-link-pending])_[aria-current=page]]:bg-transparent [&:has([data-link-pending])_[aria-current=page]]:text-muted-foreground";

function SideTab({
  activeTab,
  buddy,
  missions,
  renderBuddyPlaceholder,
  tab,
}: LearnNavigationProps & { tab: LearnTab }) {
  const routes = useLearnRoutes();

  return (
    <SidebarTooltip
      label={<TabLabel buddy={buddy} renderBuddyPlaceholder={renderBuddyPlaceholder} tab={tab} />}
    >
      <LearnLink
        aria-current={tab === activeTab ? "page" : undefined}
        className={SIDE_TAB_ITEM_CLASS}
        data-slot="sidebar-item"
        href={routes[tab]}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          <TabIcon
            buddy={buddy}
            missions={missions}
            renderBuddyPlaceholder={renderBuddyPlaceholder}
            size="sm"
            tab={tab}
          />
        </span>
        <span className="min-w-0 flex-1 truncate">
          <TabLabel buddy={buddy} renderBuddyPlaceholder={renderBuddyPlaceholder} tab={tab} />
        </span>
        {tab === "buddy" && missions && <MissionsLabel missions={missions} />}
      </LearnLink>
    </SidebarTooltip>
  );
}

/** Place it inside `Sidebar`. */
export function LearnSideNavigation(props: LearnNavigationProps) {
  return (
    <NavigationRoot className={PENDING_NAVIGATION_CLASS} data-slot="learn-side-navigation">
      <ul className="flex flex-col gap-0.5">
        {LEARN_TABS.map((tab) => (
          <li key={tab}>
            <SideTab {...props} tab={tab} />
          </li>
        ))}
      </ul>
    </NavigationRoot>
  );
}

function TabBarSearch({ onSearch }: { onSearch: () => void }) {
  const t = useExtracted();

  return (
    <button
      aria-haspopup="dialog"
      aria-keyshortcuts={shortcutKeys("search")}
      className={BOTTOM_TAB_ITEM_CLASS}
      onClick={onSearch}
      type="button"
    >
      <span className={BOTTOM_TAB_ICON_CLASS}>
        <BusyIcon>
          <SearchIcon aria-hidden="true" className="size-5" />
        </BusyIcon>
      </span>
      <span className={cn(BOTTOM_TAB_TITLE_CLASS, "@max-xs/tabs:sr-only")} data-slot="tab-title">
        {t({
          description: "The search item at the end of the phone's tab bar, after the tabs.",
          message: "Search",
        })}
      </span>
    </button>
  );
}

function BottomTab({
  activeTab,
  buddy,
  missions,
  renderBuddyPlaceholder,
  tab,
}: LearnNavigationProps & { tab: LearnTab }) {
  const routes = useLearnRoutes();
  const customName = tab === "buddy" && Boolean(buddy?.name);

  return (
    <LearnLink
      aria-current={tab === activeTab ? "page" : undefined}
      className={BOTTOM_TAB_ITEM_CLASS}
      href={routes[tab]}
    >
      <span className={BOTTOM_TAB_ICON_CLASS}>
        <TabIcon
          buddy={buddy}
          missions={missions}
          renderBuddyPlaceholder={renderBuddyPlaceholder}
          size="md"
          tab={tab}
        />
      </span>
      <span
        className={cn(
          BOTTOM_TAB_TITLE_CLASS,
          customName &&
            "truncate @max-xs/tabs:line-clamp-2 @max-xs/tabs:max-h-[2lh] @max-xs/tabs:overflow-hidden @max-xs/tabs:text-wrap @max-xs/tabs:wrap-anywhere @max-xs/tabs:hyphens-none",
        )}
        data-custom={customName || undefined}
        data-slot="tab-title"
      >
        <TabLabel buddy={buddy} renderBuddyPlaceholder={renderBuddyPlaceholder} tab={tab} />
      </span>
      {tab === "buddy" && missions && <MissionsLabel missions={missions} />}
    </LearnLink>
  );
}

const BOTTOM_TAB_SLOT_CLASS = "row-span-4 grid min-w-0 grid-cols-1 grid-rows-subgrid";

/**
 * Place it after `LearnShellMain`; toasts rise above it (`data-bottom-bar`). On a narrow bar the
 * buddy's column takes what Today, the Plan and search leave, and search keeps only its icon: with
 * large text, four titles don't fit across a phone.
 */
export function LearnBottomNavigation({
  onSearch,
  ...props
}: LearnNavigationProps & { onSearch: () => void }) {
  return (
    <NavigationRoot
      className={cn(
        "bg-background @container/tabs sticky bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] lg:hidden",
        PENDING_NAVIGATION_CLASS,
      )}
      data-bottom-bar=""
      data-slot="learn-bottom-navigation"
    >
      <ul className="mx-auto grid h-16 auto-cols-18 grid-flow-col grid-rows-[1fr_auto_auto_1fr] justify-between px-(--page-gutter) py-1 sm:max-w-3xl @max-xs/tabs:grid-cols-[max-content_max-content_minmax(--spacing(11),1fr)_max-content] @max-xs/tabs:gap-x-1 @max-xs/tabs:px-2 @max-xs/tabs:py-0">
        {LEARN_TABS.map((tab) => (
          <li className={BOTTOM_TAB_SLOT_CLASS} key={tab}>
            <BottomTab {...props} tab={tab} />
          </li>
        ))}
        <li className={BOTTOM_TAB_SLOT_CLASS}>
          <TabBarSearch onSearch={onSearch} />
        </li>
      </ul>
    </NavigationRoot>
  );
}
