import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@zoonk/ui/components/dropdown-menu";
import { getExtracted } from "next-intl/server";
import { getMenu } from "@/lib/menu";
import { ClientLink } from "../i18n/client-link";
import { LogoutDropdownItem } from "./logout-dropdown-item";

export async function UserDropdownMenu() {
  const t = await getExtracted();

  const catalogMenu = [{ key: t("My courses"), ...getMenu("myCourses") }];

  const accountMenu = [
    { key: t("Subscription"), ...getMenu("subscription") },
    { key: t("Settings"), ...getMenu("settings") },
    { key: t("Feedback"), ...getMenu("feedback") },
    { key: t("Help"), ...getMenu("help") },
  ];

  return (
    <DropdownMenuContent align="end" className="w-56">
      {catalogMenu.map((menu) => (
        <DropdownMenuItem
          key={menu.key}
          render={<ClientLink href={menu.url} />}
        >
          <menu.icon aria-hidden="true" />
          {menu.key}
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      {accountMenu.map((menu) => (
        <DropdownMenuItem
          key={menu.key}
          render={<ClientLink href={menu.url} />}
        >
          <menu.icon aria-hidden="true" />
          {menu.key}
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      <LogoutDropdownItem />
    </DropdownMenuContent>
  );
}
