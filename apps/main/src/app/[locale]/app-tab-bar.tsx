"use client";

import { authClient } from "@zoonk/auth/client";
import { DropdownMenuSeparator } from "@zoonk/ui/components/dropdown-menu";
import { useExtracted } from "next-intl";
import { AppCommandPalette } from "@/components/command-palette-app";
import {
  TabBar,
  TabBarItem,
  TabOverflow,
  TabOverflowIMenutem,
  TabOverflowMenu,
  TabOverflowTrigger,
} from "@/components/tab-bar";
import { getMenu } from "@/lib/menu";

export function AppTabBar() {
  const t = useExtracted();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";

  const menuItems = [
    { label: t("Home"), ...getMenu("home") },
    { label: t("Courses"), ...getMenu("courses") },
    { label: t("Learn"), ...getMenu("learn") },
    { label: t("Settings"), ...getMenu("settings") },
  ];

  const overflowItems = [
    { label: t("Subscription"), ...getMenu("subscription") },
    { label: t("Feedback"), ...getMenu("feedback") },
  ];

  const adminItems = [{ label: t("Editor"), ...getMenu("editor") }];

  const adminItemsUrls = adminItems.map((item) => item.url);

  return (
    <TabBar action={<AppCommandPalette />}>
      {menuItems.map((menu) => (
        <TabBarItem
          exact={menu.url === "/"}
          href={menu.url}
          icon={<menu.icon aria-hidden="true" />}
          key={menu.url}
          label={menu.label}
        />
      ))}

      <TabOverflow>
        <TabOverflowTrigger pages={adminItemsUrls} />

        <TabOverflowMenu>
          {isAdmin &&
            adminItems.map((menu) => (
              <TabOverflowIMenutem
                icon={<menu.icon aria-hidden="true" />}
                key={menu.url}
                label={menu.label}
                url={menu.url}
              />
            ))}

          {isAdmin && <DropdownMenuSeparator />}

          {overflowItems.map((menu) => (
            <TabOverflowIMenutem
              icon={<menu.icon aria-hidden="true" />}
              key={menu.url}
              label={menu.label}
              url={menu.url}
            />
          ))}
        </TabOverflowMenu>
      </TabOverflow>
    </TabBar>
  );
}
