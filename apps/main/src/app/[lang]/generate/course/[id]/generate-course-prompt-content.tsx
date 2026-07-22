import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { getCoursePromptById } from "@/data/courses/course-prompt";
import {
  type FirstCourseLessonHref,
  getFirstCourseLessonHref,
} from "@/data/courses/get-first-course-lesson-href";
import { redirect } from "@/i18n/navigation";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { type Course } from "@zoonk/db";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Empty, EmptyContent, EmptyHeader } from "@zoonk/ui/components/empty";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { GenerationClient } from "./generation-client";

type CoursePromptRedirectHref = `/b/${typeof AI_ORG_SLUG}/c/${string}` | FirstCourseLessonHref;

/**
 * Chooses when the server-rendered generation page can skip the waiting UI.
 * Language courses become useful only after the course workflow completes, but
 * regular courses can start as soon as the generated intro lesson exists.
 */
async function getCoursePromptRedirectHref({
  course,
  isLanguageCourse,
}: {
  course: Course;
  isLanguageCourse: boolean;
}): Promise<CoursePromptRedirectHref | null> {
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

export async function GenerateCoursePromptContent({
  params,
}: {
  params: Promise<{ id: string; lang: string }>;
}) {
  const { id, lang: locale } = await params;
  const request = await getCoursePromptById(id);

  if (!request?.canonicalTitle || !request.generationStatus) {
    notFound();
  }

  const linkedCourse = request.course;
  const isLanguageCourse = request.courseFormat === "language";

  if (linkedCourse) {
    const redirectHref = await getCoursePromptRedirectHref({
      course: linkedCourse,
      isLanguageCourse,
    });

    if (redirectHref) {
      return redirect({ href: redirectHref, locale });
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
        >
          <GenerationExitLink href="/" width="content">
            {t("Back home")}
          </GenerationExitLink>
        </GenerationClient>
      </ContainerBody>
    </Container>
  );
}

export function GenerateCoursePromptFallback() {
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
