"use client";

import { getMenu } from "@/lib/menu";
import { useExtracted } from "next-intl";
import { createNavigationPaletteItem } from "./command-palette-items";

export function useSettingsPaletteItems(isLoggedIn: boolean) {
  const t = useExtracted();
  const keywords = t("Settings");

  return [
    createNavigationPaletteItem({
      id: "settings",
      label: t("Settings"),
      menu: getMenu("settings"),
    }),
    ...(isLoggedIn
      ? [
          createNavigationPaletteItem({
            id: "profile",
            keywords,
            label: t("Profile"),
            menu: getMenu("profile"),
          }),
          createNavigationPaletteItem({
            id: "memory",
            keywords,
            label: t("Memory"),
            menu: getMenu("memory"),
          }),
          createNavigationPaletteItem({
            id: "subscription",
            keywords,
            label: t("Subscription"),
            menu: getMenu("subscription"),
          }),
        ]
      : []),
    createNavigationPaletteItem({
      id: "appearance",
      keywords: `${keywords} ${t("Appearance")}`,
      label: t("Preferences"),
      menu: getMenu("appearance"),
    }),
    createNavigationPaletteItem({
      id: "language",
      keywords,
      label: t("Language"),
      menu: getMenu("appearance"),
    }),
  ];
}
