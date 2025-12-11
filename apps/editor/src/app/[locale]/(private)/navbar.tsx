"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { Navbar } from "@zoonk/ui/components/navbar";
import { cn } from "@zoonk/ui/lib/utils";
import { HomeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

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
      <div className="flex items-center gap-2">
        <Link
          className={cn(
            buttonVariants({
              size: "icon",
              variant: isHome ? "default" : "secondary",
            }),
          )}
          href="/"
        >
          <HomeIcon aria-hidden="true" />
          <span className="sr-only">{t("Home page")}</span>
        </Link>
      </div>
    </Navbar>
  );
}
