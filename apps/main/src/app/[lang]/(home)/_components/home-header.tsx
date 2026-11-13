import { PublicNavLinks } from "@/components/public/public-nav-links";
import { PublicTopBar } from "@/components/public/public-top-bar";
import { PublicVisitorActions } from "@/components/public/public-visitor-actions";
import { FINAL_GOAL_ID, HERO_GOAL_ID } from "./home-ids";

export function HomeHeader() {
  return (
    <PublicTopBar
      actions={<PublicVisitorActions ownStart={{ againIds: [FINAL_GOAL_ID], id: HERO_GOAL_ID }} />}
      nav={<PublicNavLinks />}
    />
  );
}
