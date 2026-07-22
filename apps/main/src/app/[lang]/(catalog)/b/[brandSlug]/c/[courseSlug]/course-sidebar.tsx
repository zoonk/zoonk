import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogActiveShortcutLink } from "@/components/catalog/catalog-active-shortcut-link";
import {
  ContinueLessonLink,
  ContinueLessonLinkSkeleton,
} from "@/components/catalog/continue-lesson-link";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { getSession } from "@/data/users/get-session";
import { getUserHiddenLessonKinds } from "@/data/users/lesson-filter-settings";
import { GridToolbar } from "@zoonk/ui/components/grid";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CourseHeader } from "./course-header";

/**
 * Loads the course identity and learner actions independently from the chapter
 * grid so a cold request can stream whichever catalog section resolves first.
 */
export async function CourseSidebar({
  params,
}: Pick<PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">, "params">) {
  const { brandSlug, courseSlug } = await params;

  const [course, hiddenLessonKinds, session] = await Promise.all([
    getCourse({ brandSlug, courseSlug }),
    getUserHiddenLessonKinds(),
    getSession(),
  ]);

  if (!course) {
    notFound();
  }

  const chapters = await listCourseChapters({ courseId: course.id });

  const fallbackHref = chapters[0]
    ? (`/b/${brandSlug}/c/${courseSlug}/ch/${chapters[0].slug}` as const)
    : undefined;

  return (
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
  );
}
