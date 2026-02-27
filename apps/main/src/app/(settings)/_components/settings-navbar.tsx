import { getMenu } from "@/lib/menu";
import { getSession } from "@zoonk/core/users/session/get";
import { buttonVariants } from "@zoonk/ui/components/button";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { getExtracted } from "next-intl/server";
import Link from "next/link";
import { SettingsLogoutButton } from "./settings-logout-button";
import { SettingsPillLinks } from "./settings-pills";

const homeMenu = getMenu("home");

export async function SettingsNavbar() {
  const t = await getExtracted();
  const session = await getSession();
  const isLoggedIn = Boolean(session);

  return (
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 pt-4 backdrop-blur">
      <HorizontalScroll>
        <HorizontalScrollContent>
          <Link
            className={buttonVariants({ size: "icon", variant: "outline" })}
            href={homeMenu.url}
            prefetch
          >
            <homeMenu.icon aria-hidden="true" />
            <span className="sr-only">{t("Home page")}</span>
          </Link>

          <SettingsPillLinks />

          {isLoggedIn && <SettingsLogoutButton label={t("Logout")} />}
        </HorizontalScrollContent>
      </HorizontalScroll>
    </nav>
  );
}
