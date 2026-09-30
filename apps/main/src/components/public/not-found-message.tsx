import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { ArrowRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { PUBLIC_COLUMN_CLASS } from "./public-page";

const NOT_FOUND_STATUS = "404";

/**
 * What a missing page says, in plain words, with one way back home. Both the in-app 404 and the
 * one for URLs no route matches show it, so they read the same.
 */
export async function NotFoundMessage({ locale }: { locale?: SupportedLocale }) {
  const t = await getExtracted(locale ? { locale } : undefined);

  return (
    <div className={cn(PUBLIC_COLUMN_CLASS, "flex flex-1 flex-col justify-center py-16")}>
      <p className="text-muted-foreground text-sm font-medium tabular-nums">{NOT_FOUND_STATUS}</p>

      <h1 className="mt-2 text-[30px] leading-[1.1] font-bold tracking-[-0.03em] text-balance sm:text-[44px] sm:leading-[1.08]">
        {t("We couldn't find this page")}
      </h1>

      <p className="text-muted-foreground mt-3 text-base leading-relaxed text-pretty sm:mt-4 sm:text-[19px]">
        {t("The link may be old or mistyped.")}
      </p>

      {/* oxlint-disable-next-line next/no-html-link-for-pages -- A full load of the home page also resets whatever broke the route. */}
      <a className={cn(buttonVariants({ size: "lg" }), "mt-8 self-start")} href="/">
        {t("Go to the home page")}
        <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
      </a>
    </div>
  );
}
