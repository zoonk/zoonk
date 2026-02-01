"use client";

import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { authClient } from "@zoonk/core/auth/client";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LogOutIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SettingsPills } from "./settings-pills";

const homeMenu = getMenu("home");

export function SettingsNavbar() {
  const t = useExtracted();
  const { data: session } = authClient.useSession();
  const isLoggedIn = Boolean(session);

  return (
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 flex w-full items-center justify-between gap-2 px-4 pt-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
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

        <SettingsPills />
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
