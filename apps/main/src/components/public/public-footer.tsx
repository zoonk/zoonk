import { Link } from "@/i18n/navigation";
import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { getExtracted } from "next-intl/server";
import { FooterLanguages } from "./footer-languages";
import { PUBLIC_CONTAINER_CLASS } from "./landing-styles";
import { PUBLIC_FOOTER_ID } from "./public-ids";

/** Read once when the server starts, so rendering never depends on the clock. */
const COPYRIGHT_YEAR = String(new Date().getFullYear());

const FOOTER_LINK_CLASS =
  "hover:text-foreground focus-visible:ring-ring/50 hit-area relative inline-flex min-h-11 items-center rounded-md outline-none transition-colors focus-visible:ring-[3px]";

export async function PublicFooter({ pathname }: { pathname?: string }) {
  const t = await getExtracted();

  return (
    <footer className="border-t" id={PUBLIC_FOOTER_ID}>
      <div className={PUBLIC_CONTAINER_CLASS}>
        {/* The logo and the globe share a column, so the links and the languages start on one edge. */}
        <div className="text-muted-foreground grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-7 gap-y-1 py-8 text-sm">
          <ZoonkLogo className="text-foreground size-6" />

          <div className="flex flex-wrap items-center gap-x-6">
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

          <FooterLanguages pathname={pathname} />
        </div>
      </div>
    </footer>
  );
}
