import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogActiveShortcutLink } from "@/components/catalog/catalog-active-shortcut-link";
import {
  ContinueLessonLink,
  ContinueLessonLinkSkeleton,
} from "@/components/catalog/continue-lesson-link";
import { listCourseChapters } from "@zoonk/core/chapters/list-by-course";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { getLessonVisibility } from "@zoonk/core/users/lesson-visibility";
import { getSession } from "@zoonk/core/users/session";
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

  const [course, lessonVisibility, session] = await Promise.all([
    getCourse({ brandSlug, courseSlug }),
    getLessonVisibility(),
    getSession(),
  ]);

  const { hiddenLessonKinds } = lessonVisibility;

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
