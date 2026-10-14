"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { LearnSectionBar } from "@zoonk/learn/bar";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { UserAvatarMenu } from "./user-avatar-menu";

/**
 * Over the page's own edges under `lg`, as far above the title as the statistics' and settings'
 * bars sit; from `lg` the sidebar has the way back to the tabs and the account.
 */
const CATALOG_BAR_CLASS = "-mx-4 -mt-4 mb-6 sm:-mx-8 sm:-mt-6 lg:hidden";

/**
 * The way back leaves the catalog for the app page the learner left for it, or Today; a visitor
 * who landed here goes to the home page. On the right, the account's menu, or a visitor's Pricing
 * and way in (`visitor`).
 */
export function CatalogBarContent({ visitor }: { visitor: React.ReactNode }) {
  const learner = useLearnerSummary();

  if (learner.status === "visitor") {
    return <LearnSectionBar backHref="/" className={CATALOG_BAR_CLASS} end={visitor} />;
  }

  return (
    <LearnSectionBar
      backHref="/today"
      className={CATALOG_BAR_CLASS}
      end={
        learner.status === "ready" ? (
          <LearnAvatarBelt color={learner.summary.level?.color ?? null}>
            <UserAvatarMenu />
          </LearnAvatarBelt>
        ) : (
          <AvatarSkeleton className="size-7" />
        )
      }
    />
  );
}
