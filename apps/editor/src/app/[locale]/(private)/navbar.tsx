"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { Navbar } from "@zoonk/ui/components/navbar";
import { HomeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { BackButton } from "../../../components/back";

function getPage(pathname: string) {
  if (pathname === "/") {
    return "home";
  }

  return "other";
}

export function EditorNavbar() {
  const pathname = usePathname();
  const t = useExtracted();

  const isHome = getPage(pathname) === "home";

  return (
    <Navbar>
      {!isHome && <BackButton />}

      <Link
        className={buttonVariants({
          size: "icon",
          variant: isHome ? "default" : "outline",
        })}
        href="/"
      >
        <HomeIcon aria-hidden="true" />
        <span className="sr-only">{t("Home page")}</span>
      </Link>
    </Navbar>
  );
}
