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

const menuItems = [
  { key: "home", ...getMenu("home") },
  { key: "settings", ...getMenu("settings") },
  { key: "subscription", ...getMenu("subscription") },
  { key: "displayName", ...getMenu("displayName") },
  { key: "language", ...getMenu("language") },
];

export function SettingsSidebarAccount() {
  const pathname = usePathname();
  const t = useTranslations("Menu");

  return (
    <SidebarGroup>
      <SidebarGroupContent>
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
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
