import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { toGenerationResource } from "@/lib/generation-resource";
import { createGenerationRequestSchema } from "@/lib/openapi/schemas/workflows";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { getCourseGenerationAccess } from "@zoonk/core/courses/generation-access";
import { getChapterGenerationAccess } from "@zoonk/core/workflows/chapter-generation-access";
import { getLessonGenerationAccess } from "@zoonk/core/workflows/lesson-generation-access";
import { type NextRequest, NextResponse } from "next/server";
import { type Run, start } from "workflow/api";

/**
 * Returns one accepted generation through the same resource representation as
 * the status endpoint and identifies its canonical polling URL.
 */
async function acceptedGeneration(run: Run<unknown>) {
  const generation = await toGenerationResource(run);

  return NextResponse.json(generation, {
    headers: { Location: `/v1/generations/${encodeURIComponent(generation.id)}` },
    status: 202,
  });
}

/**
 * Starts the workflow selected by a validated generation target while keeping
 * every existing authorization and subscription decision in Core.
 */
async function createGeneration(request: NextRequest) {
  const parsed = await parseBody(request, createGenerationRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  if (parsed.data.target.type === "coursePrompt") {
    const access = await getCourseGenerationAccess(parsed.data.target.id);

    if (access.status === "notFound") {
      return errors.notFound();
    }

    if (access.status === "invalid") {
      return errors.badRequest(access.error);
    }

    const run = await start(courseGenerationWorkflow, [
      { coursePromptId: access.coursePromptId, userId: access.userId },
    ]);

    return acceptedGeneration(run);
  }

  if (parsed.data.target.type === "chapter") {
    const access = await getChapterGenerationAccess(parsed.data.target.id);

    if (access.status === "notFound") {
      return errors.notFound();
    }

    if (access.status === "subscriptionRequired") {
      return errors.paymentRequired();
    }

    return acceptedGeneration(await start(chapterGenerationWorkflow, [parsed.data.target.id]));
  }

  const access = await getLessonGenerationAccess(parsed.data.target.id);

  if (access.status === "notFound") {
    return errors.notFound();
  }

  if (access.status === "subscriptionRequired") {
    return errors.paymentRequired();
  }

  return acceptedGeneration(await start(lessonGenerationWorkflow, [parsed.data.target.id]));
}

export const POST = withApiErrorBoundary(createGeneration);
