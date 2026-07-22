import { CatalogDetailLayout } from "@/components/catalog/catalog-detail-layout";
import {
  CatalogGridSkeleton,
  CatalogSidebarSkeleton,
} from "@/components/catalog/catalog-skeletons";
import { getCourse } from "@/data/courses/get-course";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { Grid } from "@zoonk/ui/components/grid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CourseChapterGrid } from "./course-chapter-grid";
import { CourseSidebar } from "./course-sidebar";

export const prefetch = "allow-runtime";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">): Promise<Metadata> {
  const { brandSlug, courseSlug } = await params;
  const course = await getCourse({ brandSlug, courseSlug });

  if (!course) {
    return {};
  }

  const t = await getExtracted({ locale: course.language });

  return {
    alternates: {
      canonical: getLocalizedUrl({
        href: `/b/${brandSlug}/c/${courseSlug}`,
        language: course.language,
      }),
    },
    description: t(
      "Learn {course} online with practical examples and everyday language. {description}",
      { course: course.title, description: course.description ?? "" },
    ),
    title: t("Learn {course}", { course: course.title }),
  };
}

export default function CoursePage({ params }: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">) {
  return (
    <CatalogDetailLayout
      sidebar={
        <Suspense fallback={<CatalogSidebarSkeleton />}>
          <CourseSidebar params={params} />
        </Suspense>
      }
    >
      <Grid variant="pane">
        <Suspense fallback={<CatalogGridSkeleton count={5} groupVariant="pane" search />}>
          <CourseChapterGrid params={params} />
        </Suspense>
      </Grid>
    </CatalogDetailLayout>
  );
}
