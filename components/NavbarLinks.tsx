"use client";

import { IconUfo } from "@tabler/icons-react";
import { LayoutGrid, PlusCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
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
        <IconUfo />
        <span className="sr-only">{t("home")}</span>
      </Link>

      <Link
        href="/courses"
        className={buttonVariants({
          variant: getVariant("/courses", pathname),
          size: "adaptive",
        })}
      >
        <LayoutGrid />
        <span className="hidden sm:inline">{t("courses")}</span>
      </Link>

      <Link
        href="/start"
        className={buttonVariants({
          variant: getVariant("/start", pathname),
          size: "adaptive",
          className: "ml-auto",
        })}
      >
        <PlusCircle />
        <span className="hidden sm:inline">{t("start")}</span>
      </Link>
    </>
  );
}
