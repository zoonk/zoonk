import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@zoonk/ui/components/dropdown-menu";
import { getTranslations } from "next-intl/server";
import { getMenu } from "@/lib/menu";
import { ClientLink } from "./client-link";
import { LogoutDropdownItem } from "./logout-dropdown-item";

export async function UserDropdownMenu() {
  const t = await getTranslations("Menu");

  const catalogMenu = [{ key: t("myCourses"), ...getMenu("myCourses") }];

  const accountMenu = [
    { key: t("subscription"), ...getMenu("subscription") },
    { key: t("settings"), ...getMenu("settings") },
    { key: t("feedback"), ...getMenu("feedback") },
    { key: t("help"), ...getMenu("help") },
  ];

  return (
    <DropdownMenuContent align="end" className="w-56">
      {catalogMenu.map((menu) => (
        <DropdownMenuItem key={menu.key} asChild>
          <ClientLink href={menu.url}>
            <menu.icon aria-hidden="true" />
            {menu.key}
          </ClientLink>
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      {accountMenu.map((menu) => (
        <DropdownMenuItem key={menu.key} asChild>
          <ClientLink href={menu.url}>
            <menu.icon aria-hidden="true" />
            {menu.key}
          </ClientLink>
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      <LogoutDropdownItem />
    </DropdownMenuContent>
  );
}
