import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { buttonVariants } from "@zoonk/ui/components/button";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { SettingsLogoutButton } from "./settings-logout-button";
import { SettingsPillLinks } from "./settings-pills";

const homeMenu = getMenu("home");

const NAV_CLASS =
  "bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 pt-4 backdrop-blur";

/**
 * The settings pages and exit home share one top bar. Memory needs an account, and guardian links are
 * only for learners under 18, so those pills appear only when they apply.
 */
export async function SettingsNavbar() {
  const t = await getExtracted();
  const [session, profile] = await Promise.all([getSession(), getLearningProfile()]);
  const isLoggedIn = Boolean(session);

  return (
    <nav aria-label={t("Settings")} className={NAV_CLASS}>
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

          <SettingsPillLinks showGuardian={profile?.ageGroup === "teen"} showMemory={isLoggedIn} />

          {isLoggedIn && <SettingsLogoutButton label={t("Logout")} />}
        </HorizontalScrollContent>
      </HorizontalScroll>
    </nav>
  );
}

/**
 * Preserves the settings navigation geometry while the session-dependent
 * pills and logout control resolve on a cold page load.
 */
export function SettingsNavbarSkeleton() {
  return (
    <div className={NAV_CLASS}>
      <HorizontalScroll>
        <HorizontalScrollContent>
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-40 rounded-full" />
        </HorizontalScrollContent>
      </HorizontalScroll>
    </div>
  );
}
