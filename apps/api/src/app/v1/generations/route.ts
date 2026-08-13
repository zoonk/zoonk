import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { toGenerationResource } from "@/lib/generation-resource";
import { createGenerationRequestSchema } from "@/lib/openapi/schemas/workflows";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { getCourseGenerationAccess } from "@zoonk/core/courses/generation-access";
import { claimGenerationQuotaIfNeeded } from "@zoonk/core/generation-quotas/claim";
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

/** Returns the public quota response while keeping accepted workflow creation on the happy path. */
function reachedGenerationLimit(result: Awaited<ReturnType<typeof claimGenerationQuotaIfNeeded>>) {
  return result.status === "limitReached" ? errors.generationLimitReached(result.limit) : null;
}

/** Starts a course workflow after the course prompt and its quota claim are accepted. */
async function createCourseGeneration(coursePromptId: string) {
  const access = await getCourseGenerationAccess(coursePromptId);

  if (access.status === "notFound") {
    return errors.notFound();
  }

  if (access.status === "invalid") {
    return errors.badRequest(access.error);
  }

  const quotaResponse = reachedGenerationLimit(
    await claimGenerationQuotaIfNeeded({
      resource: "course",
      shouldClaimQuota: access.shouldClaimQuota,
      targetId: coursePromptId,
    }),
  );

  if (quotaResponse) {
    return quotaResponse;
  }

  const run = await start(courseGenerationWorkflow, [
    { coursePromptId: access.coursePromptId, userId: access.userId },
  ]);

  return acceptedGeneration(run);
}

/** Starts a chapter workflow after its subscription gate and quota claim are accepted. */
async function createChapterGeneration(chapterId: string) {
  const access = await getChapterGenerationAccess(chapterId);

  if (access.status === "notFound") {
    return errors.notFound();
  }

  if (access.status === "subscriptionRequired") {
    return errors.paymentRequired();
  }

  const quotaResponse = reachedGenerationLimit(
    await claimGenerationQuotaIfNeeded({
      resource: "chapter",
      shouldClaimQuota: access.shouldClaimQuota,
      targetId: chapterId,
    }),
  );

  if (quotaResponse) {
    return quotaResponse;
  }

  return acceptedGeneration(await start(chapterGenerationWorkflow, [chapterId]));
}

/** Starts a lesson workflow after its subscription gate and quota claim are accepted. */
async function createLessonGeneration(lessonId: string) {
  const access = await getLessonGenerationAccess(lessonId);

  if (access.status === "notFound") {
    return errors.notFound();
  }

  if (access.status === "subscriptionRequired") {
    return errors.paymentRequired();
  }

  const quotaResponse = reachedGenerationLimit(
    await claimGenerationQuotaIfNeeded({
      resource: "lesson",
      shouldClaimQuota: access.shouldClaimQuota,
      targetId: lessonId,
    }),
  );

  if (quotaResponse) {
    return quotaResponse;
  }

  return acceptedGeneration(await start(lessonGenerationWorkflow, [lessonId]));
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
    return createCourseGeneration(parsed.data.target.id);
  }

  if (parsed.data.target.type === "chapter") {
    return createChapterGeneration(parsed.data.target.id);
  }

  return createLessonGeneration(parsed.data.target.id);
}

export const POST = withApiErrorBoundary(createGeneration);
