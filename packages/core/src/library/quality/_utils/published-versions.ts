import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { prisma } from "@zoonk/db";
import { type LibraryProvenance } from "../../_utils/library-rows";
import { getScopeModel } from "../../curriculum/curriculum-scope";
import { type HeldBackDraft } from "../../generation/held-back-drafts";
import { type LessonAnalytics, type LessonGate } from "../../lessons/_utils/checked-version";
import {
  type LessonWritingInputs,
  loadPublishedLessonInputs,
  toWritingContext,
} from "../../lessons/_utils/lesson-writing-inputs";
import { type LessonScreenToSave } from "../../lessons/_utils/save-lesson-content";
import { loadLessonReuse } from "../../lessons/lesson-reuse";
import { readCurrentLessonVersion } from "../../lessons/lesson-versions";
import { getStepImageRequest } from "../../media/_utils/step-image-request";

/** Nobody waits on a lesson already published: its checks, fixes and redrafts answer at flex. */
export const BACKGROUND_TIER = chooseServiceTier({ wait: "later" });

export type CheckContext = {
  analytics?: LessonAnalytics;
  /** The lesson was made for an exam goal, which makes it very likely read again. */
  forExam?: boolean;
  lessonId: string;
  workflowRunId: string;
};

/** A private course's lesson is its owner's cost, written by its cheaper writer; a shared one, the Library's. */
export async function loadLessonScope({ analytics, lessonId, workflowRunId }: CheckContext) {
  const lesson = await prisma.lesson.findUnique({
    select: { ownerId: true },
    where: { id: lessonId },
  });

  const ownerId = lesson?.ownerId ?? null;

  return {
    analytics: {
      ...analytics,
      contentScope: ownerId ? ("personal" as const) : ("shared" as const),
      traceId: workflowRunId,
    } satisfies LessonAnalytics,
    model: getScopeModel({ ownerId }),
  };
}

export async function toTaskAnalytics(context: CheckContext): Promise<LessonAnalytics> {
  const scope = await loadLessonScope(context);
  return scope.analytics;
}

/** What a version's check reads: the lesson's plan and context, if `version` is still current. */
export async function loadCheck({
  context,
  version,
  writerModel,
}: {
  context: CheckContext;
  version: number;
  writerModel: string;
}): Promise<{ gate: LessonGate; inputs: LessonWritingInputs } | null> {
  const [inputs, reuse, current, analytics] = await Promise.all([
    loadPublishedLessonInputs(context.lessonId),
    loadLessonReuse({ forExam: context.forExam, lessonId: context.lessonId }),
    readCurrentLessonVersion(context.lessonId),
    toTaskAnalytics(context),
  ]);

  if (!inputs || current !== version) {
    return null;
  }

  return {
    gate: {
      analytics,
      context: toWritingContext(inputs),
      reuse,
      serviceTier: BACKGROUND_TIER,
      writerModel,
    },
    inputs,
  };
}

/** The version's stored screens, by position: the run that wrote each and its picture. */
export async function loadVersionSteps({
  lessonId,
  version,
}: {
  lessonId: string;
  version: number;
}) {
  return prisma.step.findMany({
    orderBy: { position: "asc" },
    select: {
      content: true,
      generatedAt: true,
      kind: true,
      mediaAssetId: true,
      model: true,
      promptVersion: true,
      runId: true,
    },
    where: { lessonId, version },
  });
}

type VersionStep = Awaited<ReturnType<typeof loadVersionSteps>>[number];

export function toProvenance(step: VersionStep): LibraryProvenance {
  return {
    generatedAt: step.generatedAt,
    model: step.model,
    promptVersion: step.promptVersion,
    runId: step.runId,
  };
}

/**
 * Keeps the pictures the replaced version already had: a new screen asking for the same picture
 * shows it at once instead of drawing it again. The rest are drawn after publishing.
 */
export function keepPictures({
  previous,
  screens,
}: {
  previous: readonly VersionStep[];
  screens: LessonScreenToSave[];
}): LessonScreenToSave[] {
  const pictures = new Map(
    previous.flatMap((step) => {
      const prompt = getStepImageRequest(step)?.prompt;
      return prompt && step.mediaAssetId ? [[prompt, step.mediaAssetId] as const] : [];
    }),
  );

  return screens.map((screen) => {
    const prompt = getStepImageRequest(screen)?.prompt;
    return { ...screen, mediaAssetId: (prompt && pictures.get(prompt)) ?? null };
  });
}

export function toHeldBackDraft({
  model,
  problems,
  workflowRunId,
}: {
  model: string;
  problems: readonly { problem: string; screen: number | null }[];
  workflowRunId: string;
}): HeldBackDraft {
  return {
    heldBackAt: new Date().toISOString(),
    model,
    problems: problems.map(({ problem, screen }) => ({ problem, screen })),
    runId: workflowRunId,
  };
}
