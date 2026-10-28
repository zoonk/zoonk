import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { prisma } from "@zoonk/db";
import { type LibraryProvenance } from "../../_utils/library-rows";
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
