import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { claimGenerationQuotaIfNeeded } from "@/lib/generation-quota";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { getNextPreloadTargetResource } from "@zoonk/core/player/commands/get-next-lesson-preload-target";
import { getChapterGenerationAccess } from "@zoonk/core/workflows/chapter-generation-access";
import { getLessonGenerationAccess } from "@zoonk/core/workflows/lesson-generation-access";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

type PreloadTarget = { chapterId: string; kind: "chapter" } | { kind: "lesson"; lessonId: string };

/**
 * Starts a derived target only after the matching Core generation boundary
 * confirms that it is an AI-owned resource the learner may generate.
 */
async function startPreloadGeneration(target: PreloadTarget) {
  if (target.kind === "chapter") {
    const access = await getChapterGenerationAccess(target.chapterId);

    if (access.status !== "ready") {
      return null;
    }

    const quota = await claimGenerationQuotaIfNeeded({
      resource: "chapter",
      shouldClaimQuota: access.shouldClaimQuota,
      target: { chapterSlug: access.chapter.slug, courseSlug: access.chapter.course.slug },
      targetId: target.chapterId,
    });

    if (quota.status === "limitReached") {
      return null;
    }

    const generation = await start(chapterGenerationWorkflow, [target.chapterId]);

    return { chapterId: target.chapterId, generationId: generation.runId, kind: target.kind };
  }

  const access = await getLessonGenerationAccess(target.lessonId);

  if (access.status !== "ready") {
    return null;
  }

  const quota = await claimGenerationQuotaIfNeeded({
    resource: "lesson",
    shouldClaimQuota: access.shouldClaimQuota,
    target: {
      chapterSlug: access.lesson.chapter.slug,
      courseSlug: access.lesson.chapter.course.slug,
      lessonSlug: access.lesson.slug,
    },
    targetId: target.lessonId,
  });

  if (quota.status === "limitReached") {
    return null;
  }

  const generation = await start(lessonGenerationWorkflow, [target.lessonId]);

  return { generationId: generation.runId, kind: target.kind, lessonId: target.lessonId };
}

/**
 * Derives the small workflow lookahead from the authenticated current lesson so
 * callers cannot select arbitrary chapter or lesson generation targets.
 */
async function createLessonPreload(
  _request: Request,
  context: RouteContext<"/v1/lessons/[lessonId]/preloads">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const resource = await getNextPreloadTargetResource({ lessonId: parsed.data.lessonId });

  if (resource.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (resource.status === "notFound") {
    return errors.notFound();
  }

  const generatedTargets = await Promise.all(resource.targets.map(startPreloadGeneration));
  const generations = generatedTargets.filter((generation) => generation !== null);

  return NextResponse.json({ generations }, { status: 202 });
}

export const POST = withApiErrorBoundary(createLessonPreload);
