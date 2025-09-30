import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { LogoutDropdownItem } from "./LogoutDropdownItem";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

interface UserDropdownMenuProps {
  locale: string;
}

export async function UserDropdownMenu({ locale }: UserDropdownMenuProps) {
  "use cache";
  cacheLife("max");

  setRequestLocale(locale);
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
          <Link href={menu.url}>
            <menu.icon aria-hidden="true" />
            {menu.key}
          </Link>
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      {accountMenu.map((menu) => (
        <DropdownMenuItem key={menu.key} asChild>
          <Link href={menu.url}>
            <menu.icon aria-hidden="true" />
            {menu.key}
          </Link>
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      <LogoutDropdownItem />
    </DropdownMenuContent>
  );
}
