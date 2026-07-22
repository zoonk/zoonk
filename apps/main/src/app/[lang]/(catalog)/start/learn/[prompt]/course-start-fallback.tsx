import { Link } from "@/i18n/navigation";
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
import { Suspense } from "react";

/**
 * Streams a neutral loading state while the server resolves the prompt's route
 * and canonical title. The copy describes the decision being made without
 * implying a list of course options will appear.
 */
export async function CourseStartFallback() {
  const t = await getExtracted();

  return (
    <Empty className="w-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Spinner />
        </EmptyMedia>

        <EmptyTitle>{t("Finding the best way to help")}</EmptyTitle>

        <EmptyDescription>
          {t("We're checking your learning goal. This may take a few seconds.")}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Suspense fallback={null}>
          <Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/start/learn">
            {t("Cancel")}
          </Link>
        </Suspense>
      </EmptyContent>
    </Empty>
  );
}
