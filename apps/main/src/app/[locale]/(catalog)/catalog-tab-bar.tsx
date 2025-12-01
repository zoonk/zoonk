import { getExtracted } from "next-intl/server";
import { AppCommandPalette } from "@/components/command-palette-app";
import { TabBar, TabBarItem } from "@/components/tab-bar";
import { getMenu } from "@/lib/menu";

export async function CatalogTabBar() {
  const t = await getExtracted();

  const menuItems = [
    { label: t("Home"), ...getMenu("home") },
    { label: t("Courses"), ...getMenu("courses") },
    { label: t("Learn"), ...getMenu("learn") },
    { label: t("Settings"), ...getMenu("settings") },
  ];

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
    </TabBar>
  );
}
