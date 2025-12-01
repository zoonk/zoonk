"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { X } from "lucide-react";
import { useExtracted } from "next-intl";
import { TabBar } from "@/components/tab-bar/tab-bar";
import { TabBarItem } from "@/components/tab-bar/tab-bar-item";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

export function SettingsTabBar() {
  const t = useExtracted();

  const settingsPages = [
    { label: t("Settings"), ...getMenu("settings") },
    { label: t("Subscription"), ...getMenu("subscription") },
    { label: t("Language"), ...getMenu("language") },
    { label: t("Display Name"), ...getMenu("displayName") },
    { label: t("Feedback"), ...getMenu("feedback") },
  ];

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
      {settingsPages.map((page) => (
        <TabBarItem
          href={page.url}
          icon={page.icon}
          key={page.label}
          label={page.label}
        />
      ))}
    </TabBar>
  );
}
