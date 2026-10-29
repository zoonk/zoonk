import { type CourseProgress } from "@/components/catalog/course-progress-contract";
import { getCourseGoalLevel } from "@zoonk/core/goals/start-course";
import { hasStartedLesson } from "@zoonk/core/lesson-player/progress";
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
    Promise.all([getCourseGoalLevel(courseId), lessonId ? hasStartedLesson({ lessonId }) : false]),
  );

  if (error) {
    logError("[courseProgressRoute] Failed to read a learner's course progress:", error);
    return new Response(null, { status: 500 });
  }

  const [level, lessonStarted] = data;
  const progress: CourseProgress = { lessonStarted, level };

  return Response.json(progress, { headers: { "Cache-Control": "private, no-store" } });
}
