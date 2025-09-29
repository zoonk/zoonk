"use client";

import { useTranslations } from "next-intl";
import { getMenuIcon } from "@/components/menuIcons";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLogout } from "@/hooks/useLogout";
import { Link, usePathname } from "@/i18n/navigation";

export function SettingsSidebarFooter() {
  const { isLoggedIn, logout } = useLogout();
  const pathname = usePathname();
  const t = useTranslations("Menu");

  const items = [
    {
      title: t("feedback"),
      url: "/feedback",
      icon: getMenuIcon("feedback"),
    },
    {
      title: t("help"),
      url: "/help",
      icon: getMenuIcon("help"),
    },
    {
      title: t("follow"),
      url: "/follow",
      icon: getMenuIcon("follow"),
    },
  ];

  return (
    <SidebarFooter>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton isActive={pathname === item.url} asChild>
              <Link href={item.url}>
                {item.icon}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}

        {isLoggedIn && (
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout}>
              {getMenuIcon("logout")}
              <span>{t("logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarFooter>
  );
}
