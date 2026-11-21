import { Link } from "@/i18n/navigation";
import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { BLOG_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";
import { FooterLanguages } from "./footer-languages";
import { FOOTER_LINKS_CLASS, FOOTER_LINK_CLASS, PUBLIC_CONTAINER_CLASS } from "./landing-styles";
import { PageStartMark } from "./page-start";

/** Read once when the server starts, so rendering never depends on the clock. */
const COPYRIGHT_YEAR = String(new Date().getFullYear());

export async function PublicFooter({ pathname }: { pathname?: string }) {
  const t = await getExtracted();

  return (
    <footer className="border-t">
      {/* A phone's start bar would cover the footer's last row. */}
      <PageStartMark />
      <div className={PUBLIC_CONTAINER_CLASS}>
        {/* The logo and the globe share a column, so the links and the languages start on one edge. */}
        <div className="text-muted-foreground grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-7 py-6 text-sm">
          <span className="flex h-11 items-center">
            <ZoonkLogo className="text-foreground size-6" />
          </span>

          <div className="flex flex-wrap items-center gap-x-6">
            <nav aria-label={t("Footer")} className={FOOTER_LINKS_CLASS}>
              <Link className={FOOTER_LINK_CLASS} href="/courses">
                {t("Courses")}
              </Link>
              <Link className={FOOTER_LINK_CLASS} href="/pricing">
                {t("Pricing")}
              </Link>
              {/* oxlint-disable-next-line next/no-html-link-for-pages -- the blog is its own site */}
              <a className={FOOTER_LINK_CLASS} href={BLOG_URL}>
                {t("Blog")}
              </a>
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

            <p className="flex min-h-11 items-center sm:ml-auto">
              {t("© {year} Zoonk", { year: COPYRIGHT_YEAR })}
            </p>
          </div>

          <FooterLanguages pathname={pathname} />
        </div>
      </div>
    </footer>
  );
}
