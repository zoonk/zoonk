"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useExperienceMode } from "../mode-provider";
import { FocusTabs } from "./focus-tabs";
import { FunDock } from "./fun-dock";
import { type LearnTab } from "./learn-tabs";

export type { LearnBuddy } from "../buddies/use-buddy-name";
export type { LearnTab } from "./learn-tabs";

/**
 * The learning tabs for the current mode: Focus pill tabs or the Fun dock.
 * Place it inside `LearnShellHeader`; it takes the center of the top bar on
 * desktop. Pass `activeTab` from the current route (`null` outside the tabs).
 */
export function LearnNavigation({
  activeTab,
  buddy = null,
}: {
  activeTab: LearnTab | null;
  /** Null until the learner picks one: Fun's dock then shows a plain buddy item. */
  buddy?: LearnBuddy | null;
}) {
  const t = useExtracted();
  const mode = useExperienceMode();

  return (
    <nav
      aria-label={t("Learning tabs")}
      className={cn(
        "lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-self-center",
        mode === "fun"
          ? "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 lg:static lg:translate-x-0"
          : "col-span-2 row-start-2",
      )}
      data-slot="learn-navigation"
    >
      {mode === "fun" ? (
        <FunDock activeTab={activeTab} buddy={buddy} />
      ) : (
        <FocusTabs activeTab={activeTab} />
      )}
    </nav>
  );
}
