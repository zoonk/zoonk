import { getExtracted } from "next-intl/server";
import { CommandPalette } from "@/components/command-palette";
import { TabBar, TabBarItem } from "@/components/tab-bar";
import { getMenu } from "@/lib/menu";

type AppTabBarProps = {
  active?: string;
};

export async function AppTabBar({ active }: AppTabBarProps) {
  const t = await getExtracted();

  const menuItems = [
    { label: t("Home"), ...getMenu("home") },
    { label: t("Courses"), ...getMenu("courses") },
    { label: t("Learn"), ...getMenu("learn") },
    { label: t("Settings"), ...getMenu("settings") },
  ];

  return (
    <TabBar action={<CommandPalette />}>
      {menuItems.map((menu) => (
        <TabBarItem
          exact={menu.url === "/"}
          href={menu.url}
          icon={<menu.icon aria-hidden="true" />}
          isActive={active === menu.url}
          key={menu.url}
          label={menu.label}
        />
      ))}
    </TabBar>
  );
}
