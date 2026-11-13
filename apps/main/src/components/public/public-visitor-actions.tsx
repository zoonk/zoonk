import { LoginBarLink } from "@/components/login-bar-link";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted } from "next-intl/server";
import { ShownAfterScrollingPast } from "./sticky-start-bar";

/** A page's own start control (`id`) and the later ones that repeat it (`againIds`). */
export type PageStart = { againIds?: string[]; id: string };

/**
 * "Log in" ends the bar on every public page. The start button sits before it and, on a page with
 * a start control of its own, shows once that has scrolled away, so the action is never on screen
 * twice.
 */
export async function PublicVisitorActions({ ownStart }: { ownStart?: PageStart }) {
  const t = await getExtracted();

  const startLink = (
    <Link className={buttonVariants({ size: "bar" })} href="/start">
      {t("Build my plan")}
    </Link>
  );

  return (
    <>
      {ownStart ? (
        <ShownAfterScrollingPast
          afterId={ownStart.id}
          className="hidden sm:block"
          hideWhileVisibleIds={ownStart.againIds}
        >
          {startLink}
        </ShownAfterScrollingPast>
      ) : (
        <span className="hidden sm:contents">{startLink}</span>
      )}

      <LoginBarLink edge="end" />
    </>
  );
}
