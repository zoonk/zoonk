import { CatalogDetailLayout } from "@/components/catalog/catalog-detail-layout";
import {
  CatalogGridSkeleton,
  CatalogSidebarSkeleton,
} from "@/components/catalog/catalog-skeletons";
import { redirect } from "@/i18n/navigation";
import { getCourseEdition } from "@zoonk/core/courses/editions";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { Grid } from "@zoonk/ui/components/grid";
import { getContentLocale } from "@zoonk/utils/locale";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { CourseChapterGrid } from "./course-chapter-grid";
import { CourseEditionNotice } from "./course-edition-notice";
import { CourseHeader } from "./course-header";
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
 * Keep exact lesson/course choices stable while adapting discovery to the UI
 * locale. Ordinary visits can reuse known editions but never start generation.
 */
export async function CourseContent({
  params,
  searchParams,
}: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">) {
  const { brandSlug, courseSlug, lang: locale } = await params;
  const course = await getCourse({ brandSlug, courseSlug });

  if (!course) {
    notFound();
  }

  if (getContentLocale(course.language) === locale) {
    return <CourseCatalog params={params} />;
  }

  const [edition, query] = await Promise.all([
    getCourseEdition({ courseId: course.id, language: locale }),
    searchParams,
  ]);

  if (edition.kind === "notFound") {
    notFound();
  }

  if (query.edition === "original") {
    return (
      <CourseCatalog
        notice={
          <CourseEditionNotice
            brandSlug={brandSlug}
            compact
            course={course}
            edition={edition}
            targetLocale={locale}
          />
        }
        params={params}
      />
    );
  }

  if (edition.kind === "course") {
    return redirect({ href: `/b/${brandSlug}/c/${edition.course.slug}`, locale });
  }

  return (
    <CatalogDetailLayout
      sidebar={<CourseHeader brandSlug={brandSlug} course={course} variant="sidebar" />}
    >
      <CourseEditionNotice
        brandSlug={brandSlug}
        course={course}
        edition={edition}
        targetLocale={locale}
      />
    </CatalogDetailLayout>
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
