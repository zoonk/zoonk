"use client";

import { useLogout } from "@zoonk/auth/hooks/logout";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@zoonk/ui/components/sidebar";
import { useExtracted } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

const logoutMenu = getMenu("logout");

export function SettingsSidebarFooter() {
  const { push } = useRouter();
  const t = useExtracted();
  const pathname = usePathname();
  const { isLoggedIn, logout } = useLogout({ onSuccess: () => push("/login") });

  const menuItems = [
    { key: t("Feedback"), ...getMenu("feedback") },
    { key: t("Help"), ...getMenu("help") },
    { key: t("Follow us"), ...getMenu("follow") },
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
              <span>{t("Logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarFooter>
  );
}
