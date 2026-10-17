import { LoginBarLink } from "@/components/login-bar-link";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/**
 * A visitor's actions in a public bar: a quiet "Log in" at every width, and "Start free" from
 * tablet widths (a phone's page has its own way to start right under the bar).
 */
export async function PublicVisitorActions() {
  const t = await getExtracted();

  return (
    <>
      <LoginBarLink />
      <Link className={cn(buttonVariants({ size: "bar" }), "hidden sm:inline-flex")} href="/start">
        {t("Start free")}
      </Link>
    </>
  );
}
