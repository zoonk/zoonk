"use client";

import { authClient } from "@zoonk/core/auth/client";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LogOutIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { SettingsNavigation } from "./settings-navigation";

const homeMenu = getMenu("home");

export function SettingsNavbar() {
  const t = useExtracted();
  const { data: session } = authClient.useSession();
  const isLoggedIn = Boolean(session);

  return (
    <nav className="sticky top-0 z-10 flex w-full items-center justify-between gap-2 bg-background/95 px-4 pt-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex items-center gap-2">
        <Link
          className={buttonVariants({
            size: "icon",
            variant: "outline",
          })}
          href={homeMenu.url}
        >
          <homeMenu.icon aria-hidden="true" />
          <span className="sr-only">{t("Home page")}</span>
        </Link>

        <Suspense>
          <SettingsNavigation />
        </Suspense>
      </div>

      {isLoggedIn && (
        <Link
          className={buttonVariants({
            size: "icon",
            variant: "secondary",
          })}
          href="/logout"
          prefetch={false}
        >
          <LogOutIcon aria-hidden="true" />
          <span className="sr-only">{t("Logout")}</span>
        </Link>
      )}
    </nav>
  );
}
