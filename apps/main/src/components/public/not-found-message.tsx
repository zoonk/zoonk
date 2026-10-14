import { StatusMessage } from "@/components/errors/status-message";
import { buttonVariants } from "@zoonk/ui/components/button";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { ArrowRightIcon, SearchXIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/**
 * What a missing page says, in plain words, with one way on: home, unless the place it's missing
 * from has a better one (the catalog's courses). Every 404 shows it, so they read the same.
 */
export async function NotFoundMessage({
  children,
  locale,
}: {
  /** The way on, in place of the home page. */
  children?: React.ReactNode;
  locale?: SupportedLocale;
}) {
  const t = await getExtracted(locale ? { locale } : undefined);

  return (
    <StatusMessage
      description={t("The link may be old or mistyped.")}
      icon={<SearchXIcon aria-hidden="true" />}
      title={t("We couldn't find this page")}
    >
      {children ?? (
        // oxlint-disable-next-line next/no-html-link-for-pages -- A full load of the home page also resets whatever broke the route.
        <a className={buttonVariants({ size: "lg" })} href="/">
          {t("Go to the home page")}
          <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
        </a>
      )}
    </StatusMessage>
  );
}
