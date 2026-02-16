"use client";

import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { authClient, logout } from "@zoonk/core/auth/client";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { LogOutIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SettingsPillLinks } from "./settings-pills";

const homeMenu = getMenu("home");

export function SettingsNavbar() {
  const t = useExtracted();
  const { data: session } = authClient.useSession();
  const isLoggedIn = Boolean(session);

  return (
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 pt-4 backdrop-blur">
      <HorizontalScroll>
        <HorizontalScrollContent className="px-4">
          <Link
            className={buttonVariants({ size: "icon", variant: "outline" })}
            href={homeMenu.url}
          >
            <homeMenu.icon aria-hidden="true" />
            <span className="sr-only">{t("Home page")}</span>
          </Link>

          <SettingsPillLinks />

          {isLoggedIn && (
            <Button className="ml-auto" onClick={() => logout()} size="icon" variant="secondary">
              <LogOutIcon aria-hidden="true" />
              <span className="sr-only">{t("Logout")}</span>
            </Button>
          )}
        </HorizontalScrollContent>
      </HorizontalScroll>
    </nav>
  );
}
