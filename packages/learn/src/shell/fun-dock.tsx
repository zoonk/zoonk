"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { GalleryVerticalEndIcon, OrbitIcon, RouteIcon, SmilePlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { FUN_DOCK_TABS, type LearnTab } from "./learn-tabs";

const DOCK_ICON_CLASS = "size-4.5 lg:size-4";

/**
 * Fun navigation: a small floating glass dock with a label on every item. It floats above the home
 * indicator on phones and sits in the top bar on desktop, where Focus has its tabs. Items grow with
 * long translations and custom buddy names. A learner who hasn't picked a buddy yet sees a plain
 * "Buddy" item, whose page asks them to pick one.
 */
export function FunDock({
  activeTab,
  buddy,
}: {
  activeTab: LearnTab | null;
  buddy: LearnBuddy | null;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const buddyName = useBuddyName(buddy ?? { kind: "zu", name: null });

  const items: Record<LearnTab, { icon: React.ReactNode; label: string }> = {
    content: { icon: <GalleryVerticalEndIcon className={DOCK_ICON_CLASS} />, label: t("Cards") },
    plan: { icon: <RouteIcon className={DOCK_ICON_CLASS} />, label: t("Route") },
    progress: buddy
      ? {
          icon: (
            <Buddy
              beltColor={buddy.beltColor}
              className="-my-1 size-7"
              energy={buddy.energy}
              glasses={buddy.glasses}
              kind={buddy.kind}
              studiedToday={buddy.studiedToday}
            />
          ),
          label: buddyName,
        }
      : { icon: <SmilePlusIcon className={DOCK_ICON_CLASS} />, label: t("Buddy") },
    today: { icon: <OrbitIcon className={DOCK_ICON_CLASS} />, label: t("Today") },
  };

  return (
    <div className="fun-dock flex items-center gap-1 rounded-[26px] p-1.5 lg:rounded-full">
      {FUN_DOCK_TABS.map((tab) => {
        const isActive = tab === activeTab;

        return (
          <LearnLink
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring flex h-12.5 min-w-16.5 flex-col items-center justify-center gap-0.5 rounded-[20px] px-2 text-xs font-semibold transition-colors outline-none focus-visible:ring-2",
              "hit-area relative",
              "lg:h-9 lg:min-w-0 lg:flex-row lg:gap-1.5 lg:rounded-full lg:px-4 lg:text-[13px]",
              isActive ? "fun-inv font-bold" : "text-fun-fg2 hover:text-fun-fg",
            )}
            href={tab === "progress" ? routes.buddy : routes[tab]}
            key={tab}
          >
            {items[tab].icon}
            <span className="max-w-24 truncate">{items[tab].label}</span>
          </LearnLink>
        );
      })}
    </div>
  );
}
