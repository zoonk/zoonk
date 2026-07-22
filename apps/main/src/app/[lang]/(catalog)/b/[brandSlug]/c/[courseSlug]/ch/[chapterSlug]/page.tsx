import { CatalogDetailLayout } from "@/components/catalog/catalog-detail-layout";
import {
  CatalogGridSkeleton,
  CatalogSidebarSkeleton,
} from "@/components/catalog/catalog-skeletons";
import { getChapter } from "@/data/chapters/get-chapter";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { Grid } from "@zoonk/ui/components/grid";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ChapterLessonGrid } from "./chapter-lesson-grid";
import { ChapterSidebar } from "./chapter-sidebar";

export const prefetch = "allow-runtime";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug } = await params;

  const chapter = await getChapter({ brandSlug, chapterSlug, courseSlug });

  if (!chapter) {
    return {};
  }

  return {
    alternates: {
      canonical: getLocalizedUrl({
        href: `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}`,
        language: chapter.course.language,
      }),
    },
    description: chapter.description,
    robots: { follow: true, index: chapter.generationStatus === "completed" },
    title: chapter.title,
  };
}

export default function ChapterPage({
  params,
}: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">) {
  return (
    <CatalogDetailLayout
      sidebar={
        <Suspense fallback={<CatalogSidebarSkeleton />}>
          <ChapterSidebar params={params} />
        </Suspense>
      }
    >
      <Grid variant="pane">
        <Suspense fallback={<CatalogGridSkeleton count={5} groupVariant="pane" search />}>
          <ChapterLessonGrid params={params} />
        </Suspense>
      </Grid>
    </CatalogDetailLayout>
  );
}
