import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LogoutDropdownItem } from "./LogoutDropdownItem";
import { getMenu } from "./menu";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

const catalogMenu = [{ key: "myCourses", ...getMenu("myCourses") }];

const accountMenu = [
  { key: "subscription", ...getMenu("subscription") },
  { key: "settings", ...getMenu("settings") },
  { key: "feedback", ...getMenu("feedback") },
  { key: "help", ...getMenu("help") },
];

interface UserDropdownMenuProps {
  locale: string;
}

export async function UserDropdownMenu({ locale }: UserDropdownMenuProps) {
  "use cache";
  cacheLife("max");

  setRequestLocale(locale);
  const t = await getTranslations("Menu");

  return (
    <DropdownMenuContent align="end" className="w-56">
      {catalogMenu.map((menu) => (
        <DropdownMenuItem key={menu.key} asChild>
          <Link href={menu.url}>
            <menu.icon aria-hidden="true" />
            {t(menu.i18nKey)}
          </Link>
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      {accountMenu.map((menu) => (
        <DropdownMenuItem key={menu.key} asChild>
          <Link href={menu.url}>
            <menu.icon aria-hidden="true" />
            {t(menu.i18nKey)}
          </Link>
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      <LogoutDropdownItem />
    </DropdownMenuContent>
  );
}
