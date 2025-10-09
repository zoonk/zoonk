"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { CommandPalette } from "./command-palette";
import { buttonVariants } from "./ui/button";

function getVariant(
  href: string,
  pathname: string,
): "outline" | "secondary" | "default" {
  if (href === pathname) {
    return "default";
  }

  if (pathname !== "/" && href !== "/" && pathname.startsWith(href)) {
    return "default";
  }

  if (href === "/learn") {
    return "secondary";
  }

  return "outline";
}

const homeMenu = getMenu("home");
const coursesMenu = getMenu("courses");
const startMenu = getMenu("start");

export function NavbarLinks() {
  const pathname = usePathname();
  const t = useTranslations("Menu");

  return (
    <>
      <Link
        href={homeMenu.url}
        className={buttonVariants({
          variant: getVariant(homeMenu.url, pathname),
          size: "icon",
        })}
      >
        <homeMenu.icon aria-hidden="true" />
        <span className="sr-only">{t("home")}</span>
      </Link>

      <Link
        href={coursesMenu.url}
        className={buttonVariants({
          variant: getVariant(coursesMenu.url, pathname),
          size: "adaptive",
        })}
      >
        <coursesMenu.icon aria-hidden="true" />
        <span className="hidden sm:inline">{t("courses")}</span>
      </Link>

      <CommandPalette />

      <Link
        href={startMenu.url}
        className={buttonVariants({
          variant: getVariant(startMenu.url, pathname),
          size: "adaptive",
          className: "ml-auto",
        })}
      >
        <startMenu.icon aria-hidden="true" />
        <span className="hidden sm:inline">{t("start")}</span>
      </Link>
    </>
  );
}
