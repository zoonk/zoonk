import { type CourseProgress } from "@/components/catalog/course-progress-contract";
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

  const { data: lessonStarted, error } = await safeAsync(async () =>
    lessonId ? hasStartedLesson({ lessonId }) : false,
  );

  if (error) {
    logError("[courseProgressRoute] Failed to read a learner's course progress:", error);
    return new Response(null, { status: 500 });
  }

  const progress: CourseProgress = { lessonStarted };

  return Response.json(progress, { headers: { "Cache-Control": "private, no-store" } });
}
