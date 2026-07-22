import { getSession } from "@/data/users/get-session";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
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

/**
 * Preserves the settings navigation geometry while the session-dependent
 * logout control resolves on a cold page load.
 */
export function SettingsNavbarSkeleton() {
  return (
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 pt-4 backdrop-blur">
      <HorizontalScroll>
        <HorizontalScrollContent>
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-40 rounded-full" />
        </HorizontalScrollContent>
      </HorizontalScroll>
    </nav>
  );
}
