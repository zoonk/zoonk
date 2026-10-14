import { LoginBarLink } from "@/components/login-bar-link";
import { PublicNavLinks } from "@/components/public/public-nav-links";
import { PublicTopBar } from "@/components/public/public-top-bar";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/**
 * The visitor home page's top bar. It's static: anyone with a session opens Today instead. The
 * brain on the left; on the right the courses (from tablet widths) and pricing, a quiet "Log in"
 * at every width, and "Start free" from tablet widths (a phone's goal box is right under the bar,
 * and its bottom bar offers "Start free" once the box scrolls away).
 */
export async function HomeHeader() {
  const t = await getExtracted();

  return (
    <PublicTopBar
      actions={
        <>
          <PublicNavLinks />
          <LoginBarLink />
          <Link
            className={cn(buttonVariants({ size: "bar" }), "hidden sm:inline-flex")}
            href="/start"
          >
            {t("Start free")}
          </Link>
        </>
      }
    />
  );
}
