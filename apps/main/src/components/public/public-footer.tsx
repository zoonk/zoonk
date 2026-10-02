import { ZoonkLogo } from "@/components/brand/zoonk-logo";
import { Link } from "@/i18n/navigation";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { PUBLIC_FOOTER_ID } from "./public-ids";

/** Read once when the server starts, so rendering never depends on the clock. */
const COPYRIGHT_YEAR = String(new Date().getFullYear());

/**
 * Each link is 44 px tall so it's easy to tap, and a short one reaches 44 px wide through its hit
 * area, so the gaps between links look even; the rows sit closer to make up for the height.
 */
const FOOTER_LINK_CLASS =
  "hover:text-foreground focus-visible:ring-ring/50 hit-area relative inline-flex min-h-11 items-center rounded-md outline-none transition-colors focus-visible:ring-[3px]";

/**
 * The public pages' footer: where to find courses, pricing, help and the
 * legal pages. Pages can put more links above it, like the home page's
 * course categories.
 */
export async function PublicFooter({ children }: { children?: ReactNode }) {
  const t = await getExtracted();

  return (
    <footer className="border-t" id={PUBLIC_FOOTER_ID}>
      {children}

      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-3 px-4 py-8 text-sm sm:px-8">
        <ZoonkLogo className="text-foreground size-6" />

        <nav aria-label={t("Footer")} className="flex flex-wrap gap-x-6">
          <Link className={FOOTER_LINK_CLASS} href="/courses">
            {t("Courses")}
          </Link>
          <Link className={FOOTER_LINK_CLASS} href="/pricing">
            {t("Pricing")}
          </Link>
          <Link className={FOOTER_LINK_CLASS} href="/support">
            {t("Help")}
          </Link>
          <Link className={FOOTER_LINK_CLASS} href="/privacy">
            {t("Privacy")}
          </Link>
          <Link className={FOOTER_LINK_CLASS} href="/terms">
            {t("Terms")}
          </Link>
        </nav>

        <p className="sm:ml-auto">{t("© {year} Zoonk", { year: COPYRIGHT_YEAR })}</p>
      </div>
    </footer>
  );
}
