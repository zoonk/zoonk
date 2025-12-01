"use client";

import { useLogout } from "@zoonk/auth/hooks/logout";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LogOutIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Suspense } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { SettingsNavigation } from "./settings-navigation";

const homeMenu = getMenu("home");

export function SettingsNavbar() {
  const { push } = useRouter();
  const t = useExtracted();
  const { isLoggedIn, logout } = useLogout({ onSuccess: () => push("/login") });

  return (
    <nav className="sticky top-0 z-10 flex w-full items-center justify-between gap-2 border-border border-b bg-background/95 p-4 backdrop-blur supports-backdrop-filter:bg-background/60">
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
        <button
          className={buttonVariants({
            size: "icon",
            variant: "secondary",
          })}
          onClick={logout}
          type="button"
        >
          <LogOutIcon aria-hidden="true" />
          <span className="sr-only">{t("Logout")}</span>
        </button>
      )}
    </nav>
  );
}
