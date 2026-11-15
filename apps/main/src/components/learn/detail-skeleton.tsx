import {
  MEASURED_CLASS,
  PAGE_COLUMN_CLASS,
  type PageMeasure,
  PageTitle,
  pageMeasureClass,
} from "@zoonk/learn/page";
import { PageWithAside } from "@zoonk/learn/shell";
import { DetailHero, DetailHeroText } from "@zoonk/ui/components/detail";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { JourneyPageBar } from "./journey-page-bar";

/**
 * Only the bar and the page's title: everything under a detail page's title takes the room the
 * learner's data decides, so it appears with the page instead of moving when it arrives.
 */
export async function DetailSkeleton({
  aside = true,
  bar,
  measure,
  title,
}: {
  aside?: boolean;
  bar?: React.ReactNode;
  measure?: PageMeasure;
  /** The page's own title when it's always the same words. */
  title?: string;
}) {
  const column = (
    <div aria-busy="true" className="flex flex-col">
      {bar ?? <JourneyPageBar />}
      <div
        className={cn(
          PAGE_COLUMN_CLASS,
          "flex flex-col",
          measure && [pageMeasureClass(measure), MEASURED_CLASS],
        )}
      >
        <DetailHero>
          <DetailHeroText>
            {title ? (
              <PageTitle>{title}</PageTitle>
            ) : (
              <Skeleton className="text-title w-72 max-w-full rounded-md">{" "}</Skeleton>
            )}
          </DetailHeroText>
        </DetailHero>
      </div>
    </div>
  );

  if (!aside) {
    return column;
  }

  const t = await getExtracted();

  return (
    <PageWithAside aside={<div aria-hidden="true" />} asideLabel={t("Loading")}>
      {column}
    </PageWithAside>
  );
}
