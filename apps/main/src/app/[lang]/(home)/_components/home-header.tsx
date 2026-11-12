import { PublicNavLinks } from "@/components/public/public-nav-links";
import { PublicTopBar } from "@/components/public/public-top-bar";
import { PublicVisitorActions } from "@/components/public/public-visitor-actions";
import { getExtracted } from "next-intl/server";

/** Its button says the page's own action, the goal box's. */
export async function HomeHeader() {
  const t = await getExtracted();

  return (
    <PublicTopBar
      actions={
        <>
          <PublicNavLinks />
          <PublicVisitorActions start={t("Build my plan")} />
        </>
      }
    />
  );
}
