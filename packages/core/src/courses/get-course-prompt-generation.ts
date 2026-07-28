import "server-only";
import { type Course } from "@zoonk/db";
import { getCourseSlugForTitle } from "./course-slug";
import { getCoursePromptById } from "./get-course-prompt";
import { getFirstCourseLesson, getFirstCourseLessonResource } from "./get-first-course-lesson";

export type CoursePromptGenerationCompletionKind = "course" | "introductionLesson";

/**
 * Resolves the route-neutral destination that becomes available while a course
 * prompt is generating. Language courses wait for the complete curriculum,
 * while core courses become usable as soon as their published intro lesson
 * exists.
 */
async function getCoursePromptGenerationTarget({
  course,
  isLanguageCourse,
}: {
  course: Course;
  isLanguageCourse: boolean;
}) {
  if (isLanguageCourse) {
    return course.generationStatus === "completed"
      ? ({ courseSlug: course.slug, kind: "course" } as const)
      : null;
  }

  const firstLesson = await getFirstCourseLesson({ courseId: course.id });

  if (firstLesson) {
    return {
      chapterSlug: firstLesson.chapterSlug,
      courseSlug: course.slug,
      kind: "lesson",
      lessonSlug: firstLesson.lessonSlug,
    } as const;
  }

  return course.generationStatus === "completed"
    ? ({ courseSlug: course.slug, kind: "course" } as const)
    : null;
}

/**
 * Gets the durable course-prompt generation resource used by delivery apps.
 * The result owns readiness and destination decisions but leaves URL creation
 * to each transport so web, native, CLI, and API clients share the same rules.
 */
export async function getCoursePromptGeneration({ coursePromptId }: { coursePromptId: string }) {
  const coursePrompt = await getCoursePromptById({ id: coursePromptId });

  if (
    !coursePrompt?.canonicalTitle ||
    !coursePrompt.courseFormat ||
    !coursePrompt.generationStatus
  ) {
    return { status: "notFound" as const };
  }

  const isLanguageCourse = coursePrompt.courseFormat === "language";

  const target = coursePrompt.course
    ? await getCoursePromptGenerationTarget({ course: coursePrompt.course, isLanguageCourse })
    : null;

  if (target) {
    return { status: "redirect" as const, target };
  }

  const completionKind: CoursePromptGenerationCompletionKind = isLanguageCourse
    ? "course"
    : "introductionLesson";

  return {
    completionKind,
    coursePromptId: coursePrompt.id,
    courseSlug: getCourseSlugForTitle({
      language: coursePrompt.language,
      title: coursePrompt.canonicalTitle,
    }),
    courseTitle: coursePrompt.canonicalTitle,
    generationRunId: coursePrompt.generationRunId,
    generationStatus: coursePrompt.generationStatus,
    isLanguageCourse,
    linkedCourseSlug: coursePrompt.course?.slug ?? null,
    status: "pending" as const,
  };
}

/**
 * Returns the durable ID-based generation state exposed by API and native
 * clients. Generation polling remains uncached so workflow status changes are
 * visible immediately, while completed targets contain no web-specific slugs.
 */
export async function getCoursePromptGenerationResource({
  coursePromptId,
}: {
  coursePromptId: string;
}) {
  const coursePrompt = await getCoursePromptById({ id: coursePromptId });

  if (
    !coursePrompt?.canonicalTitle ||
    !coursePrompt.courseFormat ||
    !coursePrompt.generationStatus
  ) {
    return { status: "notFound" as const };
  }

  if (coursePrompt.course) {
    const isLanguageCourse = coursePrompt.courseFormat === "language";

    if (isLanguageCourse && coursePrompt.course.generationStatus === "completed") {
      return {
        status: "ready" as const,
        target: { courseId: coursePrompt.course.id, kind: "course" as const },
      };
    }

    if (!isLanguageCourse) {
      const firstLesson = await getFirstCourseLessonResource({ courseId: coursePrompt.course.id });

      if (firstLesson) {
        return {
          status: "ready" as const,
          target: {
            chapterId: firstLesson.chapterId,
            courseId: coursePrompt.course.id,
            kind: "lesson" as const,
            lessonId: firstLesson.lessonId,
          },
        };
      }

      if (coursePrompt.course.generationStatus === "completed") {
        return {
          status: "ready" as const,
          target: { courseId: coursePrompt.course.id, kind: "course" as const },
        };
      }
    }
  }

  return {
    completionKind:
      coursePrompt.courseFormat === "language"
        ? ("course" as const)
        : ("introductionLesson" as const),
    courseFormat: coursePrompt.courseFormat,
    coursePromptId: coursePrompt.id,
    generationId: coursePrompt.generationRunId,
    generationStatus: coursePrompt.generationStatus,
    status: "pending" as const,
    title: coursePrompt.canonicalTitle,
  };
}
