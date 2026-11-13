import { PublicNavLinks } from "@/components/public/public-nav-links";
import { PublicTopBar } from "@/components/public/public-top-bar";
import { PublicVisitorActions } from "@/components/public/public-visitor-actions";
import { getExtracted } from "next-intl/server";
import { FINAL_GOAL_ID, HERO_GOAL_ID } from "./home-ids";

/** Its button says the page's own action, the goal box's. */
export async function HomeHeader() {
  const t = await getExtracted();

  return (
    <PublicTopBar
      actions={
        <PublicVisitorActions
          ownStart={{ againIds: [FINAL_GOAL_ID], id: HERO_GOAL_ID }}
          start={t("Build my plan")}
        />
      }
      nav={<PublicNavLinks />}
    />
  );
}
