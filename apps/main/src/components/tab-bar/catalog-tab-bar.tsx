"use client";

import { useExtracted } from "next-intl";
import { getMenu } from "@/lib/menu";
import { TabBar, TabBarItem } from "../tab-bar";
import { TabBarCommandPalette } from "./tab-bar-command-palette";

const homeMenu = getMenu("home");
const coursesMenu = getMenu("courses");
const learnMenu = getMenu("learn");
const settingsMenu = getMenu("settings");

export function CatalogTabBar() {
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
        href={coursesMenu.url}
        icon={coursesMenu.icon}
        label={t("Courses")}
      />
      <TabBarItem
        href={learnMenu.url}
        icon={learnMenu.icon}
        label={t("Learn")}
      />
      <TabBarItem
        href={settingsMenu.url}
        icon={settingsMenu.icon}
        label={t("Settings")}
      />
    </TabBar>
  );
}
