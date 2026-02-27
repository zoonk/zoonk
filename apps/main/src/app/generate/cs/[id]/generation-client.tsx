"use client";

import {
  GenerationProgressCompleted,
  GenerationProgressError,
  GenerationTimeline,
  GenerationTimelineHeader,
  GenerationTimelineProgress,
  GenerationTimelineStep,
  GenerationTimelineSteps,
  GenerationTimelineSubtitle,
  GenerationTimelineTitle,
} from "@/components/generation/generation-progress";
import {
  ACTIVITY_GENERATION_COMPLETION_STEP,
  type CourseWorkflowStepName,
} from "@/lib/workflow/config";
import { useAnimatedProgress } from "@/lib/workflow/use-animated-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useThinkingMessages } from "@/lib/workflow/use-thinking-messages";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import { type GenerationStatus } from "@zoonk/db";
import { AI_ORG_SLUG, API_URL } from "@zoonk/utils/constants";
import { useExtracted } from "next-intl";
import { useGenerationPhases } from "./use-generation-phases";

export function GenerationClient({
  courseSlug,
  generationRunId,
  generationStatus,
  suggestionId,
  targetLanguage,
}: {
  courseSlug: string;
  generationRunId: string | null;
  generationStatus: GenerationStatus;
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

  const { activePhaseNames, phases, progress, thinkingGenerators } = useGenerationPhases(
    generation.completedSteps,
    generation.currentStep,
    targetLanguage,
    generation.startedSteps,
  );

  const isActive = generation.status === "triggering" || generation.status === "streaming";
  const displayProgress = useAnimatedProgress(progress, isActive);
  const thinkingMessages = useThinkingMessages(
    thinkingGenerators,
    isActive ? activePhaseNames : [],
  );

  useCompletionRedirect({
    status: generation.status,
    url: `/b/${AI_ORG_SLUG}/c/${courseSlug}`,
  });

  if (isActive) {
    return (
      <GenerationTimeline>
        <GenerationTimelineHeader>
          <GenerationTimelineTitle>{t("Creating your course")}</GenerationTimelineTitle>
          <GenerationTimelineSubtitle>
            {t("This usually takes 4-6 minutes")}
          </GenerationTimelineSubtitle>
          <GenerationTimelineProgress label={t("Progress")} value={displayProgress} />
        </GenerationTimelineHeader>

        <GenerationTimelineSteps>
          {phases.map((phase, index) => (
            <GenerationTimelineStep
              detail={thinkingMessages[phase.name]}
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
