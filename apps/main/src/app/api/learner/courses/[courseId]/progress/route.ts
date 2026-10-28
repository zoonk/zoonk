import { type CourseProgress } from "@/components/catalog/course-progress-contract";
import { hasCourseGoal } from "@zoonk/core/goals/start-course";
import { getLessonProgress } from "@zoonk/core/lesson-player/progress";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const idSchema = z.uuid();

/**
 * Public pages are static, so the browser asks for the learner's bits after the page shows. It only
 * reads, so it needs no CSRF check, and it's never cached: it's per learner.
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
