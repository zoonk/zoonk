import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { SettingsLogoutButton } from "./settings-logout-button";
import { SettingsPillLinks } from "./settings-pills";

/** On tablets the pills keep the 600px column's edges, like the top bar and the pages. */
const NAV_CLASS = "mx-auto w-full sm:max-w-150 lg:max-w-none";

/**
 * The settings pages as pills under the top bar. Memory needs an account, and guardian links are
 * only for learners under 18, so those pills appear only when they apply.
 */
export async function SettingsNavbar() {
  const t = await getExtracted();
  const [session, profile] = await Promise.all([getSession(), getLearningProfile()]);
  const isLoggedIn = Boolean(session);

  return (
    <nav aria-label={t("Settings")} className={NAV_CLASS}>
      <HorizontalScroll>
        {/* Centered on desktop, on the same axis as the tabs above and the page below. */}
        <HorizontalScrollContent className="lg:justify-center">
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
