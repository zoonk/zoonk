"use client";

import { useExtracted } from "next-intl";
import { getMenu } from "@/lib/menu";
import { TabBar } from "./tab-bar";
import { TabBarCommandPalette } from "./tab-bar-command-palette";
import { TabBarItem } from "./tab-bar-item";

const homeMenu = getMenu("home");
const settingsMenu = getMenu("settings");
const subscriptionMenu = getMenu("subscription");
const languageMenu = getMenu("language");
const feedbackMenu = getMenu("feedback");

export function SettingsTabBar() {
  const t = useExtracted();

  return (
    <TabBar action={<TabBarCommandPalette />}>
      <TabBarItem
        exact
        href={homeMenu.url}
        icon={homeMenu.icon}
        label={t("Home")}
      />
      <TabBarItem
        exact
        href={settingsMenu.url}
        icon={settingsMenu.icon}
        label={t("Settings")}
      />
      <TabBarItem
        href={subscriptionMenu.url}
        icon={subscriptionMenu.icon}
        label={t("Subscription")}
      />
      <TabBarItem
        href={languageMenu.url}
        icon={languageMenu.icon}
        label={t("Language")}
      />
      <TabBarItem
        href={feedbackMenu.url}
        icon={feedbackMenu.icon}
        label={t("Feedback")}
      />
    </TabBar>
  );
}
