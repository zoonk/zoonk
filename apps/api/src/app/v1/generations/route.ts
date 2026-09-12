import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { claimGenerationQuotaIfNeeded } from "@/lib/generation-quota";
import { toGenerationResource } from "@/lib/generation-resource";
import { createGenerationRequestSchema } from "@/lib/openapi/schemas/workflows";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";
import { curriculumGenerationWorkflow } from "@/workflows/course-generation/curriculum-generation-workflow";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { getCourseGenerationAccess } from "@zoonk/core/courses/generation-access";
import { getChapterGenerationAccess } from "@zoonk/core/workflows/chapter-generation-access";
import { getCourseCurriculumGenerationAccess } from "@zoonk/core/workflows/course-curriculum-generation-access";
import { registerGenerationRun } from "@zoonk/core/workflows/internal/register-generation-run";
import { getLessonGenerationAccess } from "@zoonk/core/workflows/lesson-generation-access";
import { type NextRequest, NextResponse } from "next/server";
import { type Run, getRun, start } from "workflow/api";

/**
 * Returns one accepted generation through the same resource representation as
 * the status endpoint and identifies its canonical polling URL.
 */
async function acceptedGeneration(
  run: Run<unknown>,
  target: Parameters<typeof registerGenerationRun>[0]["target"],
) {
  await registerGenerationRun({ generationId: run.runId, target });
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

  if (access.status === "unauthorized") {
    return errors.unauthorized();
  }

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
      target: { coursePromptId, courseSlug: access.courseSlug },
      targetId: coursePromptId,
    }),
  );

  if (quotaResponse) {
    return quotaResponse;
  }

  const run = await start(courseGenerationWorkflow, [
    { coursePromptId: access.coursePromptId, userId: access.userId },
  ]);

  return acceptedGeneration(run, { coursePromptId });
}

/** Starts a chapter workflow after authenticated sponsorship and quota authorization. */
async function createChapterGeneration(chapterId: string) {
  const access = await getChapterGenerationAccess(chapterId);

  if (access.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (access.status === "notFound") {
    return errors.notFound();
  }

  const quotaResponse = reachedGenerationLimit(
    await claimGenerationQuotaIfNeeded({
      resource: "chapter",
      shouldClaimQuota: access.shouldClaimQuota,
      target: { chapterSlug: access.chapter.slug, courseSlug: access.chapter.course.slug },
      targetId: chapterId,
    }),
  );

  if (quotaResponse) {
    return quotaResponse;
  }

  return acceptedGeneration(await start(chapterGenerationWorkflow, [chapterId]), {
    courseId: access.chapter.courseId,
  });
}

async function createCurriculumGeneration(courseId: string) {
  const access = await getCourseCurriculumGenerationAccess({ courseId });

  if (access.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (access.status === "notFound") {
    return errors.notFound();
  }

  if (access.status === "limitReached") {
    return errors.generationLimitReached(access.limit);
  }

  if (
    access.course.generationRunId &&
    (access.course.generationStatus === "running" || !access.needsGeneration)
  ) {
    const existing = getRun(access.course.generationRunId);

    if (await existing.exists) {
      return acceptedGeneration(existing, { courseId });
    }
  }

  return acceptedGeneration(
    await start(curriculumGenerationWorkflow, [
      { contentRevision: access.course.contentRevision, courseId },
    ]),
    { courseId },
  );
}

/** Starts a lesson workflow after authenticated chapter sponsorship and quota authorization. */
async function createLessonGeneration(lessonId: string) {
  const access = await getLessonGenerationAccess(lessonId);

  if (access.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (access.status === "notFound") {
    return errors.notFound();
  }

  const quotaResponse = reachedGenerationLimit(
    await claimGenerationQuotaIfNeeded({
      resource: "lesson",
      shouldClaimQuota: access.shouldClaimQuota,
      target: {
        chapterSlug: access.lesson.chapter.slug,
        courseSlug: access.lesson.chapter.course.slug,
        lessonSlug: access.lesson.slug,
      },
      targetId: lessonId,
    }),
  );

  if (quotaResponse) {
    return quotaResponse;
  }

  return acceptedGeneration(await start(lessonGenerationWorkflow, [lessonId]), {
    courseId: access.lesson.chapter.courseId,
  });
}

/**
 * Starts the workflow selected by a validated generation target while keeping
 * authorization and generation allowances in Core.
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

  if (parsed.data.target.type === "curriculum") {
    return createCurriculumGeneration(parsed.data.target.id);
  }

  return createLessonGeneration(parsed.data.target.id);
}

export const POST = withApiErrorBoundary(createGeneration);
