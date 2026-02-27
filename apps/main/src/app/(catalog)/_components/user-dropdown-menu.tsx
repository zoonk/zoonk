import { getMenu } from "@/lib/menu";
import { getSession } from "@zoonk/core/users/session/get";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@zoonk/ui/components/dropdown-menu";
import { getExtracted } from "next-intl/server";
import Link from "next/link";
import { LogoutDropdownItem } from "./logout-dropdown-item";

export async function UserDropdownMenu() {
  const session = await getSession();
  const t = await getExtracted();

  const catalogMenu = [{ key: t("My courses"), ...getMenu("myCourses") }];

  const accountMenu = [
    { key: t("Profile"), ...getMenu("profile") },
    { key: t("Subscription"), ...getMenu("subscription") },
    { key: t("Support"), ...getMenu("support") },
  ];

  return (
    <DropdownMenuContent align="end" className="w-56">
      {catalogMenu.map((menu) => (
        <DropdownMenuItem key={menu.key} render={<Link href={menu.url} />}>
          <menu.icon aria-hidden="true" />
          {menu.key}
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      {accountMenu.map((menu) => (
        <DropdownMenuItem key={menu.key} render={<Link href={menu.url} />}>
          <menu.icon aria-hidden="true" />
          {menu.key}
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      <LogoutDropdownItem isLoggedIn={Boolean(session)} />
    </DropdownMenuContent>
  );
}
