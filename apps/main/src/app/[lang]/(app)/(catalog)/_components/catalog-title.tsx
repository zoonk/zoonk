"use client";

import { PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { useSelectedLayoutSegment } from "next/navigation";

type CatalogTitles = { allTitle: string; categoryTitles: Record<string, string> };

function CatalogTitle({ allTitle, categoryTitles }: CatalogTitles) {
  const segment = useSelectedLayoutSegment();
  return <PageTitle>{(segment && categoryTitles[segment]) ?? allTitle}</PageTitle>;
}

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
