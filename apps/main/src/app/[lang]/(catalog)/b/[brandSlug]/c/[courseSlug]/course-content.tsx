import { CatalogDetailLayout } from "@/components/catalog/catalog-detail-layout";
import {
  CatalogGridSkeleton,
  CatalogSidebarSkeleton,
} from "@/components/catalog/catalog-skeletons";
import { getCourseEdition } from "@zoonk/core/courses/editions";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { Grid } from "@zoonk/ui/components/grid";
import { getContentLocale } from "@zoonk/utils/locale";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { CourseAppLanguageNotice } from "./course-app-language-notice";
import { CourseChapterGrid } from "./course-chapter-grid";
import { CourseEditionNotice } from "./course-edition-notice";
import { CourseSidebar } from "./course-sidebar";

function CourseCatalog({
  notice,
  params,
}: Pick<PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">, "params"> & { notice?: ReactNode }) {
  return (
    <CatalogDetailLayout
      sidebar={
        <>
          <Suspense fallback={<CatalogSidebarSkeleton />}>
            <CourseSidebar params={params} />
          </Suspense>
          {notice}
        </>
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

/**
 * Keep the selected course visible and offer other editions without switching
 * the learner's course or starting generation on an ordinary visit.
 */
export async function CourseContent({
  params,
}: Pick<PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">, "params">) {
  const { brandSlug, courseSlug, lang: locale } = await params;
  const course = await getCourse({ brandSlug, courseSlug });

  if (!course) {
    notFound();
  }

  if (getContentLocale(course.language) === locale) {
    return <CourseCatalog params={params} />;
  }

  const edition = await getCourseEdition({ courseId: course.id, language: locale });

  if (edition.kind === "notFound") {
    notFound();
  }

  return (
    <>
      <CourseAppLanguageNotice
        brandSlug={brandSlug}
        courseSlug={courseSlug}
        language={course.language}
        locale={locale}
      />
      <CourseCatalog
        notice={
          <CourseEditionNotice
            brandSlug={brandSlug}
            course={course}
            edition={edition}
            targetLocale={locale}
          />
        }
        params={params}
      />
    </>
  );
}

export function CourseContentSkeleton() {
  return (
    <CatalogDetailLayout sidebar={<CatalogSidebarSkeleton />}>
      <Grid variant="pane">
        <CatalogGridSkeleton count={5} groupVariant="pane" search />
      </Grid>
    </CatalogDetailLayout>
  );
}
