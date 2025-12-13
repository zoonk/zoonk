"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { useSettings } from "./use-settings";

export function SettingsNavigation() {
  const t = useExtracted();
  const pathname = usePathname();
  const { menuPages } = useSettings();

  const settingsMenu = getMenu("settings");

  const menuItems = [
    {
      icon: settingsMenu.icon,
      key: "settings",
      label: t("Settings"),
      url: settingsMenu.url,
    },
    ...menuPages,
  ];

  const currentItem = menuItems.find((item) => item.url === pathname);
  const CurrentIcon = currentItem?.icon ?? settingsMenu.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ size: "default", variant: "outline" })}
      >
        <CurrentIcon aria-hidden="true" className="size-4" />
        <span>{currentItem?.label ?? t("Settings")}</span>
        <ChevronDownIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.url === pathname;

          return (
            <DropdownMenuItem asChild key={item.key}>
              <Link
                className={isActive ? "bg-accent" : undefined}
                href={item.url}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
