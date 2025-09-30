"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { CommandPalette } from "./CommandPalette";
import { getMenu } from "./menu";
import { buttonVariants } from "./ui/button";

function getVariant(
  href: string,
  pathname: string,
): "outline" | "secondary" | "default" {
  if (href === pathname) {
    return "default";
  }

  if (href === "/start") {
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
        <span className="sr-only">{t(homeMenu.i18nKey)}</span>
      </Link>

      <Link
        href={coursesMenu.url}
        className={buttonVariants({
          variant: getVariant(coursesMenu.url, pathname),
          size: "adaptive",
        })}
      >
        <coursesMenu.icon aria-hidden="true" />
        <span className="hidden sm:inline">{t(coursesMenu.i18nKey)}</span>
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
        <span className="hidden sm:inline">{t(startMenu.i18nKey)}</span>
      </Link>
    </>
  );
}
