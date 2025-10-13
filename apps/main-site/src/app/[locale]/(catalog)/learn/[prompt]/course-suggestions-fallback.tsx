"use client";

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
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function CourseSuggestionsFallback() {
  const t = useTranslations("LearnResults");

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
          className={buttonVariants({ variant: "outline", size: "sm" })}
          href="/learn"
        >
          {t("loadingCancel")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
