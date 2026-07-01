import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogActiveShortcutLink } from "@/components/catalog/catalog-active-shortcut-link";
import { CatalogDetailLayout } from "@/components/catalog/catalog-detail-layout";
import { CatalogGridSkeleton } from "@/components/catalog/catalog-skeletons";
import {
  ContinueLessonLink,
  ContinueLessonLinkSkeleton,
} from "@/components/catalog/continue-lesson-link";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { hasCourseProgress } from "@/data/courses/has-course-progress";
import { getUserHiddenLessonKinds } from "@/data/users/lesson-filter-settings";
import { getDefaultChapterImage } from "@/lib/catalog/default-images";
import { parseCourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { getSession } from "@zoonk/core/users/session/get";
import { Grid, GridToolbar } from "@zoonk/ui/components/grid";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ChapterList } from "./chapter-list";
import { CourseHeader } from "./course-header";
import { CourseLandingPage } from "./course-landing-page";

export async function generateMetadata({
  params,
}: PageProps<"/b/[brandSlug]/c/[courseSlug]">): Promise<Metadata> {
  const { brandSlug, courseSlug } = await params;
  const course = await getCourse({ brandSlug, courseSlug });

  if (!course) {
    return {};
  }

  const t = await getExtracted({ locale: course.language });

  return {
    description: t(
      "Learn {course} online with practical examples and everyday language. {description}",
      { course: course.title, description: course.description ?? "" },
    ),
    title: t("Learn {course}", { course: course.title }),
  };
}

export default async function CoursePage({ params }: PageProps<"/b/[brandSlug]/c/[courseSlug]">) {
  const { brandSlug, courseSlug } = await params;

  const [course, hiddenLessonKinds, session] = await Promise.all([
    getCourse({ brandSlug, courseSlug }),
    getUserHiddenLessonKinds(),
    getSession(),
  ]);

  if (!course) {
    notFound();
  }

  const [chapters, courseHasProgress] = await Promise.all([
    listCourseChapters({ courseId: course.id }),
    hasCourseProgress({ courseId: course.id }),
  ]);

  if (brandSlug === AI_ORG_SLUG && chapters.length === 0) {
    redirect(`/generate/c/${course.slug}`);
  }

  const landingPage = parseCourseLandingPageContent(course.landingPage);

  if (!courseHasProgress) {
    return (
      <CourseLandingPage
        brandSlug={brandSlug}
        chapters={chapters}
        course={course}
        courseSlug={courseSlug}
        excludedLessonKinds={hiddenLessonKinds}
        landingPage={landingPage}
      />
    );
  }

  const fallbackHref = chapters[0]
    ? (`/b/${brandSlug}/c/${courseSlug}/ch/${chapters[0].slug}` as const)
    : undefined;

  const defaultChapterImage = getDefaultChapterImage({ categories: course.categories });

  return (
    <CatalogDetailLayout
      sidebar={
        <>
          <CourseHeader brandSlug={brandSlug} course={course} variant="sidebar" />
          <GridToolbar>
            <Suspense fallback={<ContinueLessonLinkSkeleton />}>
              <ContinueLessonLink
                courseId={course.id}
                excludedLessonKinds={hiddenLessonKinds}
                fallbackHref={fallbackHref}
              />
            </Suspense>
            <Suspense fallback={null}>
              <CatalogActiveShortcutLink
                excludedLessonKinds={hiddenLessonKinds}
                items={chapters}
                kind="chapter"
                scope={{ courseId: course.id }}
              />
            </Suspense>
            <CatalogActions
              defaultEmail={session?.user.email}
              feedbackTarget={{ courseSlug, kind: "course" }}
            />
          </GridToolbar>
        </>
      }
    >
      <Grid variant="pane">
        <Suspense
          fallback={<CatalogGridSkeleton count={chapters.length} groupVariant="pane" search />}
        >
          <ChapterList
            brandSlug={brandSlug}
            chapters={chapters}
            courseId={course.id}
            courseSlug={courseSlug}
            defaultChapterImage={defaultChapterImage}
            hiddenLessonKinds={hiddenLessonKinds}
          />
        </Suspense>
      </Grid>
    </CatalogDetailLayout>
  );
}
