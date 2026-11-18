import { StatusMessage } from "@/components/errors/status-message";
import { MainDocumentLink } from "@/components/main-document-link";
import { Page } from "@zoonk/learn/page";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { SearchXIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export const NOT_FOUND_ICON = <SearchXIcon aria-hidden="true" />;

export async function getNotFoundWords(locale?: SupportedLocale) {
  const t = await getExtracted(locale ? { locale } : undefined);

  return {
    description: t("The link may be old or mistyped."),
    home: t("Go to the home page"),
    title: t("We couldn't find this page"),
    today: t("Go to Today"),
  };
}

/**
 * With no frame at all, or under the public header (`underHeader`), where the way home is outlined:
 * on a public page the header's start button is the one filled action.
 */
export async function NotFoundMessage({
  locale,
  underHeader = false,
}: {
  locale?: SupportedLocale;
  underHeader?: boolean;
}) {
  const words = await getNotFoundWords(locale);
  const button = buttonVariants({ size: "lg", variant: underHeader ? "outline" : "default" });

  // A full load also resets whatever broke the route. The signed-in look is set before the first
  // paint, so a learner is offered Today and a visitor the home page.
  return (
    <StatusMessage description={words.description} icon={NOT_FOUND_ICON} title={words.title}>
      {/* oxlint-disable-next-line next/no-html-link-for-pages -- See above. */}
      <a className={cn(button, "signed-in:hidden")} href="/">
        {words.home}
      </a>
      {/* oxlint-disable-next-line next/no-html-link-for-pages -- See above. */}
      <a className={cn(button, "signed-in:inline-flex hidden")} href="/today">
        {words.today}
      </a>
    </StatusMessage>
  );
}

export async function PageNotFound({ action }: { action?: React.ReactNode } = {}) {
  const words = await getNotFoundWords();

  return (
    <Page className="flex-1" measure="list">
      <StatusMessage description={words.description} icon={NOT_FOUND_ICON} title={words.title} />

      <BottomBar>
        <BottomBarActions>
          {action ?? <MainDocumentLink href="/today">{words.today}</MainDocumentLink>}
        </BottomBarActions>
      </BottomBar>
    </Page>
  );
}
