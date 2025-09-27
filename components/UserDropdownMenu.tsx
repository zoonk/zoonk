import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LogoutDropdownItem } from "./LogoutDropdownItem";
import { getMenuIcon } from "./menuIcons";
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

  return (
    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuItem asChild>
        <Link href="/my">
          {getMenuIcon("courses")}
          {t("myCourses")}
        </Link>
      </DropdownMenuItem>

      <DropdownMenuItem asChild>
        <Link href="/subscription">
          {getMenuIcon("subscription")}
          {t("subscription")}
        </Link>
      </DropdownMenuItem>

      <DropdownMenuItem asChild>
        <Link href="/settings">
          {getMenuIcon("settings")}
          {t("settings")}
        </Link>
      </DropdownMenuItem>

      <DropdownMenuItem asChild>
        <Link href="/feedback">
          {getMenuIcon("feedback")}
          {t("feedback")}
        </Link>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <LogoutDropdownItem />
    </DropdownMenuContent>
  );
}
