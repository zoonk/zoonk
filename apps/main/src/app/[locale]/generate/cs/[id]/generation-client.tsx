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
import { useAnimatedProgress } from "@/lib/workflow/use-animated-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import {
  ACTIVITY_GENERATION_COMPLETION_STEP,
  type CourseWorkflowStepName,
} from "@/workflows/config";
import { type GenerationStatus } from "@zoonk/db";
import { AI_ORG_SLUG, API_URL } from "@zoonk/utils/constants";
import { useExtracted } from "next-intl";
import { useGenerationPhases } from "./use-generation-phases";

export function GenerationClient({
  courseSlug,
  generationRunId,
  generationStatus,
  locale,
  suggestionId,
  targetLanguage,
}: {
  courseSlug: string;
  generationRunId: string | null;
  generationStatus: GenerationStatus;
  locale: string;
  suggestionId: number;
  targetLanguage: string | null;
}) {
  const t = useExtracted();

  const generation = useWorkflowGeneration<CourseWorkflowStepName>({
    completionStep: ACTIVITY_GENERATION_COMPLETION_STEP,
    initialRunId: generationRunId,
    initialStatus: generationStatus === "running" ? "streaming" : "idle",
    statusUrl: `${API_URL}/v1/workflows/course-generation/status`,
    triggerBody: { courseSuggestionId: suggestionId },
    triggerUrl: `${API_URL}/v1/workflows/course-generation/trigger`,
  });

  const { phases, progress } = useGenerationPhases(
    generation.completedSteps,
    generation.currentStep,
    targetLanguage,
  );

  const displayProgress = useAnimatedProgress(
    progress,
    generation.status === "triggering" || generation.status === "streaming",
  );

  useCompletionRedirect({
    status: generation.status,
    url: `/${locale}/b/${AI_ORG_SLUG}/c/${courseSlug}`,
  });

  if (generation.status === "triggering" || generation.status === "streaming") {
    return (
      <GenerationTimeline>
        <GenerationTimelineHeader>
          <GenerationTimelineTitle>{t("Creating your course")}</GenerationTimelineTitle>
          <GenerationTimelineProgress label={t("Progress")} value={displayProgress} />
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
      <GenerationProgressCompleted subtitle={t("Taking you to your course...")}>
        {t("Your course is ready")}
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
        {t("Something went wrong")}
      </GenerationProgressError>
    );
  }

  return null;
}
