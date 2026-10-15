"use client";

import { PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { useSelectedLayoutSegment } from "next/navigation";

type CatalogTitles = { allTitle: string; categoryTitles: Record<string, string> };

/** "Explore courses", or the open category's title. */
function CatalogTitle({ allTitle, categoryTitles }: CatalogTitles) {
  const segment = useSelectedLayoutSegment();
  return <PageTitle>{(segment && categoryTitles[segment]) ?? allTitle}</PageTitle>;
}

/**
 * The catalog's large title over its categories and courses: "Explore courses", or the category's
 * title on a category's page, with one line on what the catalog is for. It sits above the
 * categories (the layout keeps both while the courses change), so it follows the chosen category.
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
        <CatalogTitle allTitle={allTitle} categoryTitles={categoryTitles} />
        <PageSubtitle>{subtitle}</PageSubtitle>
      </PageHeaderContent>
    </PageHeader>
  );
}
