import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonRegenerationRequestSchema } from "@/lib/openapi/schemas/lesson-regenerations";
import { readBody } from "@/lib/request-input";
import { startOnce } from "@/workflows/_shared/run-token";
import { getLessonContentHookToken } from "@/workflows/lessons/lesson-content-result";
import { lessonContentWorkflow } from "@/workflows/lessons/lesson-content-workflow";
import { pullLessonsForRegeneration } from "@zoonk/core/library/lessons/regenerate";
import { type NextRequest, NextResponse } from "next/server";

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

async function createLessonRegeneration(request: NextRequest) {
  const parsed = await readBody(request, lessonRegenerationRequestSchema);

  const result = await pullLessonsForRegeneration(parsed);

  if (result.status !== "pulled") {
    return refusedRegeneration(result.status);
  }

  await Promise.all(
    result.lessonIds.map((lessonId) =>
      startOnce(
        lessonContentWorkflow,
        [{ forceReview: true, lessonId }],
        getLessonContentHookToken(lessonId),
      ),
    ),
  );

  return NextResponse.json({ lessonIds: result.lessonIds }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(createLessonRegeneration);
