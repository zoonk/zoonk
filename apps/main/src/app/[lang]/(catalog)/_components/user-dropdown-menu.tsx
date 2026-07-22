import { getSession } from "@/data/users/get-session";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@zoonk/ui/components/dropdown-menu";
import { getExtracted } from "next-intl/server";
import { LogoutDropdownItem } from "./logout-dropdown-item";

export async function UserDropdownMenu() {
  const session = await getSession();
  const t = await getExtracted();

  const catalogMenu = [{ key: t("My courses"), ...getMenu("myCourses") }];

  const accountMenu = [
    { key: t("Profile"), ...getMenu("profile") },
    { key: t("Subscription"), ...getMenu("subscription") },
  ];

  const resourcesMenu = [
    { key: t("Blog"), prefetch: false, ...getMenu("blog") },
    { key: t("Feedback & Support"), prefetch: true, ...getMenu("support") },
  ];

  return (
    <DropdownMenuContent align="end" className="w-56">
      {catalogMenu.map((menu) => (
        <DropdownMenuItem key={menu.key} render={<Link href={menu.url} prefetch />}>
          <menu.icon aria-hidden="true" />
          {menu.key}
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      {accountMenu.map((menu) => (
        <DropdownMenuItem key={menu.key} render={<Link href={menu.url} prefetch />}>
          <menu.icon aria-hidden="true" />
          {menu.key}
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      {resourcesMenu.map((menu) => (
        <DropdownMenuItem key={menu.key} render={<Link href={menu.url} prefetch={menu.prefetch} />}>
          <menu.icon aria-hidden="true" />
          {menu.key}
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      <LogoutDropdownItem isLoggedIn={Boolean(session)} />
    </DropdownMenuContent>
  );
}
