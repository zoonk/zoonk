import { StatusMessage } from "@/components/errors/status-message";
import { buttonVariants } from "@zoonk/ui/components/button";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { ArrowRightIcon, SearchXIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/**
 * What a missing page says, in plain words, with one way back home. Both the in-app 404 and the
 * one for URLs no route matches show it, so they read the same.
 */
export async function NotFoundMessage({ locale }: { locale?: SupportedLocale }) {
  const t = await getExtracted(locale ? { locale } : undefined);

  return (
    <StatusMessage
      description={t("The link may be old or mistyped.")}
      icon={<SearchXIcon aria-hidden="true" />}
      title={t("We couldn't find this page")}
    >
      {/* oxlint-disable-next-line next/no-html-link-for-pages -- A full load of the home page also resets whatever broke the route. */}
      <a className={buttonVariants({ size: "lg" })} href="/">
        {t("Go to the home page")}
        <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
      </a>
    </StatusMessage>
  );
}
