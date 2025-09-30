"use client";

import { useTranslations } from "next-intl";
import { getMenu } from "@/components/menu";
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

  const menuItems = [
    { key: t("home"), ...getMenu("home") },
    { key: t("settings"), ...getMenu("settings") },
    { key: t("subscription"), ...getMenu("subscription") },
    { key: t("displayName"), ...getMenu("displayName") },
    { key: t("language"), ...getMenu("language") },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupContent>
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
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
