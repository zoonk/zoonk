import "server-only";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { type Course, type CoursePrompt, getAiGenerationCourseWhere, prisma } from "@zoonk/db";
import { type AiCourseHref, getAiCourseHref } from "../course-href";

export type CoursePromptWithCourse = CoursePrompt & { course: Course | null };

/**
 * Looks for the reusable AI course that would be produced from this canonical
 * title. This mirrors the workflow slug rule so the start flow can skip
 * generation only when the exact generated course identity already exists.
 */
async function findCompletedReusableCourse({
  language,
  title,
}: {
  language: string;
  title: string;
}): Promise<Course | null> {
  const slug = getCourseSlugForTitle({ language, title });

  return prisma.course.findFirst({
    where: getAiGenerationCourseWhere({
      format: "core",
      generationStatus: "completed",
      isPublished: true,
      language,
      slug,
    }),
  });
}

/**
 * Keeps the prompt row aligned with the reusable course it resolved to. The
 * prompt remains the audit/cache record for the learner input, but it no longer
 * needs a workflow run once a completed course can satisfy it.
 */
async function linkPromptToCourse({
  course,
  prompt,
}: {
  course: Course;
  prompt: CoursePrompt;
}): Promise<void> {
  if (
    prompt.courseId === course.id &&
    prompt.generationRunId === null &&
    prompt.generationStatus === "completed"
  ) {
    return;
  }

  await prisma.coursePrompt.update({
    data: { courseId: course.id, generationRunId: null, generationStatus: "completed" },
    where: { id: prompt.id },
  });
}

/**
 * Treats an already-linked course as reusable only when the public route can
 * serve it immediately. Other generation states still need the generate page.
 */
function getLinkedCompletedCourse(prompt: CoursePromptWithCourse): Course | null {
  if (prompt.course?.generationStatus === "completed" && prompt.course.isPublished) {
    return prompt.course;
  }

  return null;
}

/**
 * Resolves the completed course that can satisfy this prompt without
 * generation. The relation wins when present; otherwise the canonical title is
 * converted into the same locale-aware slug the workflow would create.
 */
async function getReusableCourseForPrompt(prompt: CoursePromptWithCourse): Promise<Course | null> {
  const linkedCourse = getLinkedCompletedCourse(prompt);

  if (linkedCourse) {
    return linkedCourse;
  }

  if (!prompt.canonicalTitle) {
    return null;
  }

  return findCompletedReusableCourse({ language: prompt.language, title: prompt.canonicalTitle });
}

/**
 * Returns the public course URL for prompts that can be satisfied by an
 * existing completed course, while updating the prompt row so future reads know
 * which course fulfilled the learner prompt.
 */
export async function getReusableCourseHrefForCoursePrompt(
  prompt: CoursePromptWithCourse,
): Promise<AiCourseHref | null> {
  const reusableCourse = await getReusableCourseForPrompt(prompt);

  if (!reusableCourse) {
    return null;
  }

  await linkPromptToCourse({ course: reusableCourse, prompt });

  return getAiCourseHref(reusableCourse);
}
