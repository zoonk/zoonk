"use client";

import type { GenerationStatus } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { useExtracted } from "next-intl";
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
import type { StepName } from "@/workflows/course-generation/types";
import { useGenerationPhases } from "./use-generation-phases";

export function GenerationClient({
  courseSlug,
  generationRunId,
  generationStatus,
  locale,
  suggestionId,
}: {
  courseSlug: string;
  generationRunId: string | null;
  generationStatus: GenerationStatus;
  locale: string;
  suggestionId: number;
}) {
  const t = useExtracted();

  const generation = useWorkflowGeneration<StepName>({
    completionStep: "addLessons",
    initialRunId: generationRunId,
    initialStatus: generationStatus === "running" ? "streaming" : "idle",
    statusUrl: "/api/workflows/course-generation/status",
    triggerBody: { courseSuggestionId: suggestionId },
    triggerUrl: "/api/workflows/course-generation/trigger",
  });

  const { phases, progress } = useGenerationPhases(
    generation.completedSteps,
    generation.currentStep,
  );

  useCompletionRedirect({
    status: generation.status,
    url: `/${locale}/b/${AI_ORG_SLUG}/c/${courseSlug}`,
  });

  if (generation.status === "triggering" || generation.status === "streaming") {
    return (
      <GenerationTimeline>
        <GenerationTimelineHeader>
          <GenerationTimelineTitle>
            {t("Creating your course")}
          </GenerationTimelineTitle>
          <GenerationTimelineProgress
            label={t("Generation progress")}
            value={progress}
          />
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
      <GenerationProgressCompleted
        subtitle={t("Redirecting to your course...")}
      >
        {t("Course generated")}
      </GenerationProgressCompleted>
    );
  }

  if (generation.status === "error") {
    return (
      <GenerationProgressError
        description={
          generation.error || t("Something went wrong. Please try again.")
        }
        onRetry={generation.retry}
        retryLabel={t("Try again")}
      >
        {t("Generation failed")}
      </GenerationProgressError>
    );
  }

  return null;
}
