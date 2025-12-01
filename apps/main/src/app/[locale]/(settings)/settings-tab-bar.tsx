"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { Ellipsis, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { TabBar } from "@/components/tab-bar/tab-bar";
import { TabBarItem } from "@/components/tab-bar/tab-bar-item";
import { Link, usePathname } from "@/i18n/navigation";
import { useSettings } from "./use-settings";

const MOBILE_VISIBLE_COUNT = 5;

export function SettingsTabBar() {
  const t = useExtracted();
  const pathname = usePathname();
  const { settingsPages } = useSettings();

  const visiblePages = settingsPages.slice(0, MOBILE_VISIBLE_COUNT);
  const overflowPages = settingsPages.slice(MOBILE_VISIBLE_COUNT);

  const isOverflowActive = overflowPages.some((page) =>
    pathname.startsWith(page.url),
  );

  return (
    <TabBar
      action={
        <Link
          className={buttonVariants({ size: "icon", variant: "ghost" })}
          href="/"
        >
          <X aria-hidden="true" />
          <span className="sr-only">{t("Home")}</span>
        </Link>
      }
    >
      {/* Mobile: Show first 5 items */}
      {visiblePages.map((page) => (
        <TabBarItem
          href={page.url}
          icon={page.icon}
          key={page.label}
          label={page.label}
        />
      ))}

      {/* Mobile: Show overflow menu for remaining items */}
      {overflowPages.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({
                size: "icon",
                variant: isOverflowActive ? "default" : "ghost",
              }),
              "rounded-full md:hidden",
            )}
          >
            <Ellipsis aria-hidden="true" />
            <span className="sr-only">{t("See more")}</span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" side="top">
            {overflowPages.map((page) => (
              <DropdownMenuItem asChild key={page.label}>
                <Link href={page.url}>
                  <page.icon aria-hidden="true" />
                  {page.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Desktop: Show remaining items directly */}
      {overflowPages.map((page) => (
        <div className="hidden md:block" key={page.label}>
          <TabBarItem href={page.url} icon={page.icon} label={page.label} />
        </div>
      ))}
    </TabBar>
  );
}
