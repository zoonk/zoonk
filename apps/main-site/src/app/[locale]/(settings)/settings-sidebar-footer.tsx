"use client";

import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@zoonk/ui/components/sidebar";
import { useTranslations } from "next-intl";
import { useLogout } from "@/hooks/use-logout";
import { Link, usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

const logoutMenu = getMenu("logout");

export function SettingsSidebarFooter() {
  const { isLoggedIn, logout } = useLogout();
  const pathname = usePathname();
  const t = useTranslations("Menu");

  const menuItems = [
    { key: t("feedback"), ...getMenu("feedback") },
    { key: t("help"), ...getMenu("help") },
    { key: t("follow"), ...getMenu("follow") },
  ];

  return (
    <SidebarFooter>
      <SidebarMenu>
        {menuItems.map((item) => (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton isActive={pathname === item.url} asChild>
              <Link href={item.url}>
                <item.icon aria-hidden="true" />
                <span>{item.key}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}

        {isLoggedIn && (
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout}>
              <logoutMenu.icon aria-hidden="true" />
              <span>{t("logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarFooter>
  );
}
