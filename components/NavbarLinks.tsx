"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { CommandPalette } from "./CommandPalette";
import { getMenuIcon } from "./menuIcons";
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

export function NavbarLinks() {
  const pathname = usePathname();
  const t = useTranslations("Menu");

  return (
    <>
      <Link
        href="/"
        className={buttonVariants({
          variant: getVariant("/", pathname),
          size: "icon",
        })}
      >
        {getMenuIcon("home")}
        <span className="sr-only">{t("home")}</span>
      </Link>

      <Link
        href="/courses"
        className={buttonVariants({
          variant: getVariant("/courses", pathname),
          size: "adaptive",
        })}
      >
        {getMenuIcon("courses")}
        <span className="hidden sm:inline">{t("courses")}</span>
      </Link>

      <CommandPalette />

      <Link
        href="/start"
        className={buttonVariants({
          variant: getVariant("/start", pathname),
          size: "adaptive",
          className: "ml-auto",
        })}
      >
        {getMenuIcon("start")}
        <span className="hidden sm:inline">{t("start")}</span>
      </Link>
    </>
  );
}
