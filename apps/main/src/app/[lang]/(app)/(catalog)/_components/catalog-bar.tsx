import { VisitorBarLinks } from "@/components/login-bar-link";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { LearnSectionBar } from "@zoonk/learn/bar";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { Suspense } from "react";
import { UserAvatarMenu } from "./user-avatar-menu";

/**
 * Over the page's own edges under `lg`, as far above the title as the statistics' and settings'
 * bars sit; from `lg` the sidebar has the way back to the tabs and the account.
 */
const CATALOG_BAR_CLASS = "-mx-4 -mt-4 mb-6 sm:-mx-8 sm:-mt-6 lg:hidden";

/**
 * The way back leaves the catalog for the app page the learner left for it, or Today; a visitor
 * who landed here goes to the home page. On the right, the account's menu, or a visitor's Pricing
 * and way in.
 */
async function CatalogBarContent() {
  const session = await getSession();

  if (!session) {
    return <LearnSectionBar backHref="/" className={CATALOG_BAR_CLASS} end={<VisitorBarLinks />} />;
  }

  const belt = await getBeltLevel();

  return (
    <LearnSectionBar
      backHref="/today"
      className={CATALOG_BAR_CLASS}
      end={
        <LearnAvatarBelt color={belt?.color ?? null}>
          <UserAvatarMenu />
        </LearnAvatarBelt>
      }
    />
  );
}

/**
 * The catalog's bar on phones and tablets, where the app's tab bar has no way back from it and no
 * account: the catalog is a section of the app, as statistics and settings are. Its height is
 * `--catalog-bar`, under which the category chips stay in reach.
 */
export function CatalogBar() {
  return (
    <Suspense
      fallback={
        <LearnSectionBar
          backHref="/today"
          className={CATALOG_BAR_CLASS}
          end={<AvatarSkeleton className="size-7" />}
        />
      }
    >
      <CatalogBarContent />
    </Suspense>
  );
}
