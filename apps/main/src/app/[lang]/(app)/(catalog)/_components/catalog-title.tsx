"use client";

import { PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { useSelectedLayoutSegment } from "next/navigation";

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
}: {
  allTitle: string;
  categoryTitles: Record<string, string>;
  className?: string;
  subtitle: string;
}) {
  const segment = useSelectedLayoutSegment();
  const title = (segment && categoryTitles[segment]) ?? allTitle;

  return (
    <PageHeader className={className}>
      <PageHeaderContent>
        <PageTitle>{title}</PageTitle>
        <PageSubtitle>{subtitle}</PageSubtitle>
      </PageHeaderContent>
    </PageHeader>
  );
}
