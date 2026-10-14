"use client";

import { PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useSelectedLayoutSegment } from "next/navigation";
import { Suspense } from "react";

type CatalogTitles = { allTitle: string; categoryTitles: Record<string, string> };

/** "Explore courses", or the open category's title. */
function CatalogTitle({ allTitle, categoryTitles }: CatalogTitles) {
  const segment = useSelectedLayoutSegment();
  return <PageTitle>{(segment && categoryTitles[segment]) ?? allTitle}</PageTitle>;
}

/** The title's line while the open category is only known once its page opens. */
function CatalogTitleSkeleton() {
  return (
    <div aria-hidden="true" className="text-title flex h-lh items-center">
      <Skeleton className="h-8 w-56 max-w-full rounded-md" />
    </div>
  );
}

/**
 * The catalog's large title over its categories and courses: "Explore courses", or the category's
 * title on a category's page, with one line on what the catalog is for. It sits above the
 * categories (the layout keeps both while the courses change), so it follows the chosen category.
 * A category's page is a dynamic route, so its title has its own `Suspense`: the page's shell is
 * the same for every category.
 */
export function CatalogHeader({
  allTitle,
  categoryTitles,
  className,
  subtitle,
}: CatalogTitles & { className?: string; subtitle: string }) {
  return (
    <PageHeader className={className}>
      <PageHeaderContent>
        <Suspense fallback={<CatalogTitleSkeleton />}>
          <CatalogTitle allTitle={allTitle} categoryTitles={categoryTitles} />
        </Suspense>
        <PageSubtitle>{subtitle}</PageSubtitle>
      </PageHeaderContent>
    </PageHeader>
  );
}
