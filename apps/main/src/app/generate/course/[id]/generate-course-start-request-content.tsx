import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { getCourseStartRequestById } from "@/data/courses/course-start-request";
import {
  type FirstCourseLessonHref,
  getFirstCourseLessonHref,
} from "@/data/courses/get-first-course-lesson-href";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { type Course } from "@zoonk/db";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Empty, EmptyContent, EmptyHeader } from "@zoonk/ui/components/empty";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { GenerationClient } from "./generation-client";

type CourseStartRequestRedirectHref =
  | `/b/${typeof AI_ORG_SLUG}/c/${string}`
  | FirstCourseLessonHref;

/**
 * Chooses when the server-rendered generation page can skip the waiting UI.
 * Language courses become useful only after the course workflow completes, but
 * regular courses can start as soon as the generated intro lesson exists.
 */
async function getCourseStartRequestRedirectHref({
  course,
  isLanguageCourse,
}: {
  course: Course;
  isLanguageCourse: boolean;
}): Promise<CourseStartRequestRedirectHref | null> {
  const courseHref = `/b/${AI_ORG_SLUG}/c/${course.slug}` as const;

  if (isLanguageCourse) {
    return course.generationStatus === "completed" ? courseHref : null;
  }

  const lessonHref = await getFirstCourseLessonHref({
    courseId: course.id,
    courseSlug: course.slug,
  });

  if (lessonHref) {
    return lessonHref;
  }

  return course.generationStatus === "completed" ? courseHref : null;
}

export async function GenerateCourseStartRequestContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getCourseStartRequestById(id);

  if (!request?.canonicalTitle || !request.generationStatus) {
    notFound();
  }

  const linkedCourse = request.course;
  const isLanguageCourse = Boolean(request.targetLanguage);

  if (linkedCourse) {
    const redirectHref = await getCourseStartRequestRedirectHref({
      course: linkedCourse,
      isLanguageCourse,
    });

    if (redirectHref) {
      redirect(redirectHref);
    }
  }

  const t = await getExtracted();

  const courseSlug = getCourseSlugForTitle({
    language: request.language,
    title: request.canonicalTitle,
  });

  return (
    <Container variant="narrow">
      <ContainerBody>
        <GenerationClient
          courseSlug={courseSlug}
          courseTitle={request.canonicalTitle}
          linkedCourseSlug={linkedCourse?.slug ?? null}
          generationRunId={request.generationRunId}
          generationStatus={request.generationStatus}
          isLanguageCourse={isLanguageCourse}
          requestId={id}
        />
        <GenerationExitLink href="/">{t("Back home")}</GenerationExitLink>
      </ContainerBody>
    </Container>
  );
}

export function GenerateCourseStartRequestFallback() {
  return (
    <Container variant="narrow">
      <ContainerBody>
        <Empty className="border-0">
          <EmptyHeader>
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </EmptyHeader>
          <EmptyContent>
            <Skeleton className="h-9 w-36 rounded-full" />
          </EmptyContent>
        </Empty>
      </ContainerBody>
    </Container>
  );
}
