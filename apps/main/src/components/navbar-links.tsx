"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { CommandPalette } from "./command-palette";

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
const learnMenu = getMenu("learn");

export function NavbarLinks() {
  const pathname = usePathname();
  const t = useTranslations("Menu");

  return (
    <>
      <Link
        className={buttonVariants({
          size: "icon",
          variant: getVariant(homeMenu.url, pathname),
        })}
        href={homeMenu.url}
      >
        <homeMenu.icon aria-hidden="true" />
        <span className="sr-only">{t("home")}</span>
      </Link>

      <Link
        className={buttonVariants({
          size: "adaptive",
          variant: getVariant(coursesMenu.url, pathname),
        })}
        href={coursesMenu.url}
      >
        <coursesMenu.icon aria-hidden="true" />
        <span className="hidden sm:inline">{t("courses")}</span>
      </Link>

      <CommandPalette />

      <Link
        className={buttonVariants({
          className: "ml-auto",
          size: "adaptive",
          variant: getVariant(learnMenu.url, pathname),
        })}
        href={learnMenu.url}
      >
        <learnMenu.icon aria-hidden="true" />
        <span className="hidden sm:inline">{t("learn")}</span>
      </Link>
    </>
  );
}
