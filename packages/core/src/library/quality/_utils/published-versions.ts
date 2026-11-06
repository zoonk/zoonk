import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { prisma } from "@zoonk/db";
import { type HeldBackDraft } from "../../generation/held-back-drafts";
import {
  type LessonAnalytics,
  type LessonGate,
  readLessonSources,
} from "../../lessons/_utils/checked-version";
import {
  type LessonWritingInputs,
  loadPublishedLessonInputs,
  toWritingContext,
} from "../../lessons/_utils/lesson-writing-inputs";
import {
  type LessonScreenToSave,
  type ScreenProvenance,
} from "../../lessons/_utils/save-lesson-content";
import { loadLessonReuse } from "../../lessons/lesson-reuse";
import { readCurrentLessonVersion } from "../../lessons/lesson-versions";
import { getPictureKey } from "../../media/_utils/step-image-request";

export const BACKGROUND_TIER = chooseServiceTier({ wait: "later" });

export type CheckContext = {
  analytics?: LessonAnalytics;
  forExam?: boolean;
  lessonId: string;
  workflowRunId: string;
};

export async function toTaskAnalytics({
  analytics,
  lessonId,
  workflowRunId,
}: CheckContext): Promise<LessonAnalytics> {
  const lesson = await prisma.lesson.findUnique({
    select: { ownerId: true },
    where: { id: lessonId },
  });

  return {
    ...analytics,
    contentScope: lesson?.ownerId ? "personal" : "shared",
    traceId: workflowRunId,
  };
}

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
      sources: readLessonSources(inputs),
      writerModel,
    },
    inputs,
  };
}

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
      sourceId: true,
      sources: { select: { contentHash: true, sourceId: true } },
    },
    where: { lessonId, version },
  });
}

type VersionStep = Awaited<ReturnType<typeof loadVersionSteps>>[number];

/** A screen cited before versions were recorded keeps its citation as a read of unknown version. */
export function toProvenance(step: VersionStep): ScreenProvenance {
  const cited = step.sourceId ? [{ contentHash: null, sourceId: step.sourceId }] : [];

  return {
    generatedAt: step.generatedAt,
    model: step.model,
    promptVersion: step.promptVersion,
    runId: step.runId,
    sources: step.sources.length > 0 ? step.sources : cited,
  };
}

export function keepPictures({
  previous,
  screens,
}: {
  previous: readonly VersionStep[];
  screens: LessonScreenToSave[];
}): LessonScreenToSave[] {
  const pictures = new Map(
    previous.flatMap((step) => {
      const key = getPictureKey(step);
      return key && step.mediaAssetId ? [[key, step.mediaAssetId] as const] : [];
    }),
  );

  return screens.map((screen) => {
    const key = getPictureKey(screen);
    return { ...screen, mediaAssetId: (key && pictures.get(key)) ?? null };
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
