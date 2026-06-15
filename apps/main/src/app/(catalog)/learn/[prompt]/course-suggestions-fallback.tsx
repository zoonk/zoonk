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
import { getExtracted } from "next-intl/server";
import Link from "next/link";

export async function CourseSuggestionsFallback() {
  const t = await getExtracted();

  return (
    <Empty className="w-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Spinner />
        </EmptyMedia>

        <EmptyTitle>{t("Finding the best way to reach your goal")}</EmptyTitle>

        <EmptyDescription>
          {t(
            "We're checking your goal and putting together the right starting point. This may take a few seconds.",
          )}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/learn">
          {t("Cancel")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
