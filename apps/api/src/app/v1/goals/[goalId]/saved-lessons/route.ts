import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { saveLessonSchema } from "@zoonk/core/saved-lessons/contract";
import { listCurrentUserSavedLessons } from "@zoonk/core/saved-lessons/list";
import { saveLesson } from "@zoonk/core/saved-lessons/save";
import { NextResponse } from "next/server";

type SavedLessonsContext = RouteContext<"/v1/goals/[goalId]/saved-lessons">;

async function listSavedLessons(_request: Request, context: SavedLessonsContext) {
  const { goalId } = await readPathParams(context, goalPathParamsSchema);
  const result = await listCurrentUserSavedLessons({ goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json({ lessons: result.lessons });
}

async function setSavedLesson(request: Request, context: SavedLessonsContext) {
  const [path, body] = await Promise.all([
    readPathParams(context, goalPathParamsSchema),
    readBody(request, saveLessonSchema),
  ]);

  const result = await saveLesson({ ...body, goalId: path.goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json({ lessonId: body.lessonId, saved: result.saved });
}

export const GET = withApiErrorBoundary(listSavedLessons);
export const POST = withApiErrorBoundary(setSavedLesson);
