"use client";

import { useTranslations } from "next-intl";
import { getMenuIcon } from "@/components/menuIcons";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";

export function SettingsSidebarAccount() {
  const pathname = usePathname();
  const t = useTranslations("Menu");

  const items = [
    {
      title: t("home"),
      url: "/",
      icon: getMenuIcon("home"),
    },
    {
      title: t("settings"),
      url: "/settings",
      icon: getMenuIcon("settings"),
    },
    {
      title: t("subscription"),
      url: "/subscription",
      icon: getMenuIcon("subscription"),
    },
    {
      title: t("displayName"),
      url: "/name",
      icon: getMenuIcon("displayName"),
    },
    {
      title: t("language"),
      url: "/language",
      icon: getMenuIcon("language"),
    },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupContent>
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
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
