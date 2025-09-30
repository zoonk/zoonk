"use client";

import { useTranslations } from "next-intl";
import { getMenu } from "@/components/menu";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLogout } from "@/hooks/useLogout";
import { Link, usePathname } from "@/i18n/navigation";

const menuItems = [
  { key: "feedback", ...getMenu("feedback") },
  { key: "help", ...getMenu("help") },
  { key: "follow", ...getMenu("follow") },
];

const logoutMenu = getMenu("logout");

export function SettingsSidebarFooter() {
  const { isLoggedIn, logout } = useLogout();
  const pathname = usePathname();
  const t = useTranslations("Menu");

  return (
    <SidebarFooter>
      <SidebarMenu>
        {menuItems.map((item) => (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton isActive={pathname === item.url} asChild>
              <Link href={item.url}>
                <item.icon aria-hidden="true" />
                <span>{t(item.i18nKey)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}

        {isLoggedIn && (
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout}>
              <logoutMenu.icon aria-hidden="true" />
              <span>{t(logoutMenu.i18nKey)}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarFooter>
  );
}
