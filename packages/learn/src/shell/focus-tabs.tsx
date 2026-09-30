"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { FOCUS_TABS, type LearnTab } from "./learn-tabs";

/**
 * Focus navigation: pill tabs in their own row on phones and in the center of
 * the top bar on desktop. Buttons keep a 44px touch area around the pill.
 */
export function FocusTabs({ activeTab }: { activeTab: LearnTab | null }) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  const labels: Record<LearnTab, string> = {
    content: t("Content"),
    plan: t("Plan"),
    progress: t("Progress"),
    today: t("Today"),
  };

  return (
    <div className="lg:bg-muted flex flex-wrap items-center gap-1.5 lg:flex-nowrap lg:rounded-full lg:p-1">
      {FOCUS_TABS.map((tab) => {
        const isActive = tab === activeTab;

        return (
          <LearnLink
            aria-current={isActive ? "page" : undefined}
            className={cn(
              buttonVariants({ size: "sm", variant: isActive ? "default" : "secondary" }),
              "lg:h-9 lg:px-4",
              !isActive && "lg:text-muted-foreground lg:hover:text-foreground lg:bg-transparent",
            )}
            href={routes[tab]}
            key={tab}
          >
            {labels[tab]}
          </LearnLink>
        );
      })}
    </div>
  );
}
