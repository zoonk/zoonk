"use client";

import {
  GenerationProgressCompleted,
  GenerationProgressError,
  GenerationTimeline,
  GenerationTimelineHeader,
  GenerationTimelineProgress,
  GenerationTimelineStep,
  GenerationTimelineSteps,
  GenerationTimelineTitle,
} from "@/components/generation/generation-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import { type ActivityStepName, getActivityCompletionStep } from "@/workflows/config";
import { type ActivityKind, type GenerationStatus } from "@zoonk/db";
import { AI_ORG_SLUG, API_URL } from "@zoonk/utils/constants";
import { useExtracted } from "next-intl";
import { useGenerationPhases } from "./use-generation-phases";

export function GenerationClient({
  activityKind,
  chapterSlug,
  courseSlug,
  generationRunId,
  generationStatus,
  lessonId,
  lessonSlug,
  locale,
  position,
}: {
  activityKind: ActivityKind;
  chapterSlug: string;
  courseSlug: string;
  generationRunId: string | null;
  generationStatus: GenerationStatus;
  lessonId: number;
  lessonSlug: string;
  locale: string;
  position: number;
}) {
  const t = useExtracted();

  const completionStep = getActivityCompletionStep(activityKind);

  const generation = useWorkflowGeneration<ActivityStepName>({
    completionStep,
    initialRunId: generationRunId,
    initialStatus: generationStatus === "running" ? "streaming" : "idle",
    statusUrl: `${API_URL}/v1/workflows/activity-generation/status`,
    triggerBody: { lessonId },
    triggerUrl: `${API_URL}/v1/workflows/activity-generation/trigger`,
  });

  const { phases, progress } = useGenerationPhases(
    generation.completedSteps,
    generation.currentStep,
  );

  useCompletionRedirect({
    status: generation.status,
    url: `/${locale}/b/${AI_ORG_SLUG}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}/a/${position}`,
  });

  if (generation.status === "triggering" || generation.status === "streaming") {
    return (
      <GenerationTimeline>
        <GenerationTimelineHeader>
          <GenerationTimelineTitle>{t("Creating your activity")}</GenerationTimelineTitle>
          <GenerationTimelineProgress label={t("Generation progress")} value={progress} />
        </GenerationTimelineHeader>

        <GenerationTimelineSteps>
          {phases.map((phase, index) => (
            <GenerationTimelineStep
              icon={phase.icon}
              isLast={index === phases.length - 1}
              key={phase.name}
              status={phase.status}
            >
              {phase.label}
            </GenerationTimelineStep>
          ))}
        </GenerationTimelineSteps>
      </GenerationTimeline>
    );
  }

  if (generation.status === "completed") {
    return (
      <GenerationProgressCompleted subtitle={t("Redirecting to your activity...")}>
        {t("Activity generated")}
      </GenerationProgressCompleted>
    );
  }

  if (generation.status === "error") {
    return (
      <GenerationProgressError
        description={generation.error || t("Something went wrong. Please try again.")}
        onRetry={generation.retry}
        retryLabel={t("Try again")}
      >
        {t("Generation failed")}
      </GenerationProgressError>
    );
  }

  return null;
}
