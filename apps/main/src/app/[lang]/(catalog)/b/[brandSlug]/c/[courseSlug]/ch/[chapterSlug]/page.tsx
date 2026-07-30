import { CatalogDetailLayout } from "@/components/catalog/catalog-detail-layout";
import {
  CatalogGridSkeleton,
  CatalogSidebarSkeleton,
} from "@/components/catalog/catalog-skeletons";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getChapter } from "@zoonk/core/chapters/get-by-slug";
import { Grid } from "@zoonk/ui/components/grid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ChapterLessonGrid } from "./chapter-lesson-grid";
import { ChapterSidebar } from "./chapter-sidebar";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug } = await params;

  const chapter = await getChapter({ brandSlug, chapterSlug, courseSlug });

  if (!chapter) {
    return {};
  }

  const t = await getExtracted({ locale: chapter.course.language });

  return {
    alternates: {
      canonical: getLocalizedUrl({
        href: `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}`,
        language: chapter.course.language,
      }),
    },
    description: t("Chapter about {chapter} in the {course} course. {description}", {
      chapter: chapter.title,
      course: chapter.course.title,
      description: chapter.description,
    }),
    robots: { follow: true, index: true },
    title: t("{chapter}: {course} course", {
      chapter: chapter.title,
      course: chapter.course.title,
    }),
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
