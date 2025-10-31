"use client";

import { useLogout } from "@zoonk/auth/hooks/logout";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@zoonk/ui/components/sidebar";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

const logoutMenu = getMenu("logout");

export function SettingsSidebarFooter() {
  const { push } = useRouter();
  const t = useTranslations("Menu");
  const pathname = usePathname();
  const { isLoggedIn, logout } = useLogout({ onSuccess: () => push("/login") });

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
            <SidebarMenuButton asChild isActive={pathname === item.url}>
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
