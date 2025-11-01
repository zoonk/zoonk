import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { Spinner } from "@zoonk/ui/components/spinner";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function CourseSuggestionsFallback() {
  const t = await getTranslations("LearnResults");

  return (
    <Empty className="w-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Spinner />
        </EmptyMedia>

        <EmptyTitle>{t("loadingTitle")}</EmptyTitle>

        <EmptyDescription>{t("loadingSubtitle")}</EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href="/learn"
        >
          {t("loadingCancel")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
