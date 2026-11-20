"use client";

import { PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { useSelectedLayoutSegment } from "next/navigation";

type CatalogTitles = { allTitle: string; categoryTitles: Record<string, string> };

export function CatalogHeader({
  allTitle,
  categoryTitles,
  className,
  courseCounts,
  subtitle,
  total,
}: CatalogTitles & {
  className?: string;
  courseCounts: Readonly<Record<string, number>>;
  subtitle: string;
  total: number;
}) {
  const segment = useSelectedLayoutSegment();
  const hasCourses = segment ? (courseCounts[segment] ?? 0) > 0 : total > 0;

  return (
    <PageHeader className={className}>
      <PageHeaderContent>
        <PageTitle>{(segment && categoryTitles[segment]) ?? allTitle}</PageTitle>
        {hasCourses && <PageSubtitle>{subtitle}</PageSubtitle>}
      </PageHeaderContent>
    </PageHeader>
  );
}
