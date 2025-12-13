"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { DropdownMenuSeparator } from "@zoonk/ui/components/dropdown-menu";
import { Navbar } from "@zoonk/ui/components/navbar";
import { cn } from "@zoonk/ui/lib/utils";
import { HomeIcon } from "lucide-react";
import { useSelectedLayoutSegments } from "next/navigation";
import { useExtracted } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LogoutMenuItem } from "./logout-menu-item";
import { OrgSwitcher } from "./org-switcher";

export function EditorNavbar() {
  const t = useExtracted();

  const segments = useSelectedLayoutSegments();
  const isHome = segments.length === 0;

  return (
    <Navbar>
      <div className="flex items-center gap-2">
        <Link
          className={cn(
            buttonVariants({
              size: "icon",
              variant: isHome ? "default" : "outline",
            }),
          )}
          href="/"
        >
          <HomeIcon aria-hidden="true" />
          <span className="sr-only">{t("Home page")}</span>
        </Link>
      </div>

      {isHome && (
        <OrgSwitcher>
          <DropdownMenuSeparator />
          <LogoutMenuItem />
        </OrgSwitcher>
      )}
    </Navbar>
  );
}
