import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { lessonVisibilityUpdateSchema } from "@/lib/openapi/schemas/current-learning";
import { getLessonVisibility, updateLessonVisibility } from "@zoonk/core/users/lesson-visibility";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Returns the authenticated learner's durable hidden lesson kinds.
 */
async function getCurrentUserLessonVisibility() {
  const visibility = await getLessonVisibility({ requireAuthentication: true });

  if (!visibility) {
    return errors.unauthorized();
  }

  return NextResponse.json(visibility);
}

/**
 * Replaces the authenticated learner's hidden lesson kinds.
 */
async function updateCurrentUserLessonVisibility(request: NextRequest) {
  const parsed = await parseBody(request, lessonVisibilityUpdateSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await updateLessonVisibility(parsed.data);

  if (!result) {
    return errors.unauthorized();
  }

  return NextResponse.json({ hiddenLessonKinds: result.hiddenLessonKinds });
}

export const GET = withApiErrorBoundary(getCurrentUserLessonVisibility);
export const PATCH = withApiErrorBoundary(updateCurrentUserLessonVisibility);
