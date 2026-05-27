"use client";

import {
  GenerationProgressCompleted,
  GenerationTimeline,
  GenerationTimelineHeader,
  GenerationTimelineProgress,
  GenerationTimelineStep,
  GenerationTimelineSteps,
  GenerationTimelineSubtitle,
  GenerationTimelineTitle,
} from "@/components/generation/generation-progress";
import { WorkflowGenerationError } from "@/components/generation/workflow-generation-error";
import { useAnimatedProgress } from "@/lib/workflow/use-animated-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useThinkingMessages } from "@/lib/workflow/use-thinking-messages";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import { COURSE_COMPLETION_STEP, type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type GenerationStatus } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { API_URL } from "@zoonk/utils/url";
import { useExtracted } from "next-intl";
import { useGenerationPhases } from "./use-generation-phases";

export function GenerationClient({
  courseSlug,
  generationRunId,
  generationStatus,
  linkedCourseSlug,
  suggestionId,
}: {
  courseSlug: string;
  generationRunId: string | null;
  generationStatus: GenerationStatus;
  linkedCourseSlug: string | null;
  suggestionId: string;
}) {
  const t = useExtracted();

  const generation = useWorkflowGeneration<CourseWorkflowStepName>({
    completionStep: COURSE_COMPLETION_STEP,
    initialRunId: generationRunId,
    initialStatus: generationStatus === "running" ? "streaming" : "idle",
    statusUrl: `${API_URL}/v1/workflows/course-generation/status`,
    triggerBody: { courseSuggestionId: suggestionId },
    triggerUrl: `${API_URL}/v1/workflows/course-generation/trigger`,
  });

  const {
    activePhaseDurationMs,
    activePhaseNames,
    phases,
    progress,
    targetProgress,
    thinkingGenerators,
  } = useGenerationPhases(
    generation.completedSteps,
    generation.currentStep,
    generation.startedSteps,
  );

  const isActive = generation.status === "triggering" || generation.status === "streaming";

  const displayProgress = useAnimatedProgress({
    estimatedDurationMs: activePhaseDurationMs,
    isActive,
    realProgress: progress,
    targetProgress,
  });

  const thinkingMessages = useThinkingMessages(
    thinkingGenerators,
    isActive ? activePhaseNames : [],
  );

  const redirectSlug = generation.completionEntityId ?? linkedCourseSlug ?? courseSlug;

  useCompletionRedirect({ status: generation.status, url: `/b/${AI_ORG_SLUG}/c/${redirectSlug}` });

  if (isActive) {
    return (
      <GenerationTimeline>
        <GenerationTimelineHeader>
          <GenerationTimelineTitle>{t("Creating your course")}</GenerationTimelineTitle>
          <GenerationTimelineSubtitle>
            {t("This usually takes about 2 minutes")}
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
      <WorkflowGenerationError
        error={generation.error}
        errorKind={generation.errorKind}
        onRetry={generation.retry}
      />
    );
  }

  return null;
}
