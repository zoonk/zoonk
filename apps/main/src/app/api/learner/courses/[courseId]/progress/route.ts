import { type CourseProgress } from "@/components/catalog/course-progress-contract";
import { hasCourseGoal } from "@zoonk/core/goals/start-course";
import { getLessonProgress } from "@zoonk/core/lesson-player/progress";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const idSchema = z.uuid();

/**
 * The learner's own bits of a course's, a chapter's or a lesson's public page: whether a goal of
 * theirs follows the course ("Continue your plan" instead of "Build my plan") and whether they're
 * partway through the page's lesson (`?lesson=`: "Continue the lesson" instead of its first
 * question). Those pages are static, the same for everyone, so the browser asks for these after
 * the page shows, and only with a session; the page's visitor version stands until then.
 *
 * A same-origin read of the session cookie that writes nothing itself, so it needs no CSRF check.
 * Never cached: it's per learner and changes with their next answer.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/learner/courses/[courseId]/progress">,
) {
  const { courseId } = await context.params;
  const lessonId = new URL(request.url).searchParams.get("lesson");

  if (
    !idSchema.safeParse(courseId).success ||
    (lessonId && !idSchema.safeParse(lessonId).success)
  ) {
    return new Response(null, { status: 400 });
  }

  const { data, error } = await safeAsync(() =>
    Promise.all([hasCourseGoal(courseId), lessonId ? getLessonProgress({ lessonId }) : []]),
  );

  if (error) {
    logError("[courseProgressRoute] Failed to read a learner's course progress:", error);
    return new Response(null, { status: 500 });
  }

  const [followsCourse, answers] = data;
  const progress: CourseProgress = { followsCourse, lessonStarted: answers.length > 0 };

  return Response.json(progress, { headers: { "Cache-Control": "private, no-store" } });
}
