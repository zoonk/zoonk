import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { lessonRegenerationRequestSchema } from "@/lib/openapi/schemas/lesson-regenerations";
import { lessonContentWorkflow } from "@/workflows/v2/lessons/lesson-content-workflow";
import { pullLessonsForRegeneration } from "@zoonk/core/library/lessons/regenerate";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

function refusedRegeneration(status: "forbidden" | "invalid" | "unauthorized") {
  if (status === "unauthorized") {
    return errors.unauthorized();
  }

  if (status === "forbidden") {
    return errors.forbidden();
  }

  return errors.badRequest("Send a model, a prompt version or both");
}

/**
 * Lets an admin rewrite the lessons a model or prompt version wrote (from the admin feedback
 * queue's downvote rates, for example). Core takes the lessons out of play; each gets a writing
 * run with the reasoning check, like a lesson that failed a later review.
 */
async function createLessonRegeneration(request: NextRequest) {
  const parsed = await parseBody(request, lessonRegenerationRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await pullLessonsForRegeneration(parsed.data);

  if (result.status !== "pulled") {
    return refusedRegeneration(result.status);
  }

  await Promise.all(
    result.lessonIds.map((lessonId) =>
      start(lessonContentWorkflow, [{ forceReview: true, lessonId }]),
    ),
  );

  return NextResponse.json({ lessonIds: result.lessonIds }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(createLessonRegeneration);
