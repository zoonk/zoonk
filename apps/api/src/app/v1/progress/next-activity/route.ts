import { getNextChapterActivity } from "@/data/progress/get-next-chapter-activity";
import {
  type NextActivityResult,
  getNextCourseActivity,
} from "@/data/progress/get-next-course-activity";
import { getNextLessonActivity } from "@/data/progress/get-next-lesson-activity";
import { errors } from "@/lib/api-errors";
import { nextActivityQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { getSession } from "@zoonk/core/users/session/get";
import { NextResponse } from "next/server";

function getNextActivity(
  userId: number,
  scope: {
    chapterId?: number;
    courseId?: number;
    lessonId?: number;
  },
): Promise<NextActivityResult> {
  if (scope.courseId) {
    return getNextCourseActivity(userId, scope.courseId);
  }

  if (scope.chapterId) {
    return getNextChapterActivity(userId, scope.chapterId);
  }

  return getNextLessonActivity(userId, scope.lessonId ?? 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, nextActivityQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { chapterId, courseId, lessonId } = parsed.data;
  const session = await getSession(request.headers);
  const userId = session ? Number(session.user.id) : 0;

  const result = await getNextActivity(userId, { chapterId, courseId, lessonId });

  if (!result) {
    return NextResponse.json({ completed: false, hasStarted: false });
  }

  return NextResponse.json(result);
}
