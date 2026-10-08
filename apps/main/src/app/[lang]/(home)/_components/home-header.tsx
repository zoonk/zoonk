import { LoginBarLink } from "@/components/login-bar-link";
import { PublicTopBar } from "@/components/public/public-top-bar";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { HOW_IT_WORKS_ID } from "./home-ids";

const NAV_LINK_CLASS =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px]";

/**
 * The visitor home page's top bar. It's static: signed-in learners never see
 * this page, because the proxy sends them to Today first. The section links
 * join the two account actions only from desktop widths, where every language's
 * labels fit on one line; below that the page's own sections lead.
 */
export async function HomeHeader() {
  const t = await getExtracted();

  return (
    <PublicTopBar
      actions={
        <>
          <LoginBarLink className="sm:border-transparent sm:bg-transparent" />
          <Link
            className={cn(buttonVariants({ size: "bar" }), "hidden sm:inline-flex")}
            href="/start"
          >
            {t("Try free")}
          </Link>
        </>
      }
      navigation={
        <nav
          aria-label={t("Home page sections")}
          className="hidden items-center gap-7 text-sm lg:flex"
        >
          <a className={NAV_LINK_CLASS} href={`#${HOW_IT_WORKS_ID}`}>
            {t("How it works")}
          </a>
          <Link className={NAV_LINK_CLASS} href="/pricing">
            {t("Pricing")}
          </Link>
        </nav>
      }
    />
  );
}
