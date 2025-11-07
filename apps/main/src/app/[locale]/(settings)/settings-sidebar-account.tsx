"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@zoonk/ui/components/sidebar";
import { useExtracted } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

export function SettingsSidebarAccount() {
  const pathname = usePathname();
  const t = useExtracted();

  const menuItems = [
    { key: t("Home page"), ...getMenu("home") },
    { key: t("Settings"), ...getMenu("settings") },
    { key: t("Subscription"), ...getMenu("subscription") },
    { key: t("Display name"), ...getMenu("displayName") },
    { key: t("Language"), ...getMenu("language") },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.key}>
              <SidebarMenuButton asChild isActive={pathname === item.url}>
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
