"use client";

import { authClient } from "@zoonk/auth/client";
import { useExtracted } from "next-intl";
import { AppCommandPalette } from "@/components/command-palette-app";
import { TabBar, TabBarItem } from "@/components/tab-bar";
import { getMenu } from "@/lib/menu";

const settingsMenu = getMenu("settings");

export function AppTabBar() {
  const t = useExtracted();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";

  const menuItems = [
    { label: t("Home"), ...getMenu("home") },
    { label: t("Courses"), ...getMenu("courses") },
    { label: t("Learn"), ...getMenu("learn") },
  ];

  const adminItems = [{ label: t("Editor"), ...getMenu("editor") }];

  return (
    <TabBar action={<AppCommandPalette />}>
      {menuItems.map((menu) => (
        <TabBarItem
          exact={menu.url === "/"}
          href={menu.url}
          icon={<menu.icon aria-hidden="true" />}
          key={menu.url}
          label={menu.label}
        />
      ))}

      {isAdmin &&
        adminItems.map((menu) => (
          <TabBarItem
            href={menu.url}
            icon={<menu.icon aria-hidden="true" />}
            key={menu.url}
            label={menu.label}
          />
        ))}

      <TabBarItem
        href={settingsMenu.url}
        icon={<settingsMenu.icon aria-hidden="true" />}
        key={settingsMenu.url}
        label={t("Settings")}
      />
    </TabBar>
  );
}
