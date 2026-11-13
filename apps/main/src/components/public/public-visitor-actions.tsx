import { LoginBarLink } from "@/components/login-bar-link";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted } from "next-intl/server";
import { ShownWhenStartAway } from "./page-start";

/**
 * "Log in" ends the bar on every public page. The start button sits before it and, on a page with
 * a start control of its own, shows once that has scrolled away, so the action is never on screen
 * twice.
 */
export async function PublicVisitorActions({ ownStart = false }: { ownStart?: boolean }) {
  const t = await getExtracted();

  const startLink = (
    <Link className={buttonVariants({ size: "bar" })} href="/start">
      {t("Build my plan")}
    </Link>
  );

  return (
    <>
      {ownStart ? (
        <ShownWhenStartAway className="hidden sm:block">{startLink}</ShownWhenStartAway>
      ) : (
        <span className="hidden sm:contents">{startLink}</span>
      )}

      <LoginBarLink edge="end" />
    </>
  );
}
