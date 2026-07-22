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
import { type GenerationStatus, isGenerationInProgress } from "@/lib/workflow/generation-store";
import { useAnimatedProgress } from "@/lib/workflow/use-animated-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useThinkingMessages } from "@/lib/workflow/use-thinking-messages";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import { CHAPTER_COMPLETION_STEP, type ChapterWorkflowStepName } from "@zoonk/core/workflows/steps";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { API_URL } from "@zoonk/utils/url";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { useGenerationPhases } from "./use-generation-phases";

export function GenerationClient({
  chapterId,
  chapterSlug,
  chapterTitle,
  children,
  courseSlug,
  generationRunId,
  initialStatus,
  invalidateContent,
}: {
  chapterId: string;
  chapterSlug: string;
  chapterTitle: string;
  children: ReactNode;
  courseSlug: string;
  generationRunId: string | null;
  initialStatus: GenerationStatus;
  invalidateContent: () => Promise<void>;
}) {
  const t = useExtracted();

  const generation = useWorkflowGeneration<ChapterWorkflowStepName>({
    completionStep: CHAPTER_COMPLETION_STEP,
    initialRunId: generationRunId,
    initialStatus,
    statusUrl: `${API_URL}/v1/workflows/chapter-generation/status`,
    triggerBody: { chapterId },
    triggerUrl: `${API_URL}/v1/workflows/chapter-generation/trigger`,
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

  const isActive = isGenerationInProgress(generation.status);

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

  useCompletionRedirect({
    beforeRedirect: invalidateContent,
    status: generation.status,
    url: `/b/${AI_ORG_SLUG}/c/${courseSlug}/ch/${chapterSlug}`,
  });

  if (isActive) {
    return (
      <>
        <GenerationTimeline>
          <GenerationTimelineHeader>
            <GenerationTimelineTitle>
              {t("Creating the {title} chapter", { title: chapterTitle })}
            </GenerationTimelineTitle>
            <GenerationTimelineSubtitle>
              {t("This usually takes about a minute")}
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
        {children}
      </>
    );
  }

  if (generation.status === "completed") {
    return (
      <GenerationProgressCompleted subtitle={t("Taking you to your chapter...")}>
        {t("Your lessons are ready")}
      </GenerationProgressCompleted>
    );
  }

  if (generation.status === "error") {
    return (
      <>
        <WorkflowGenerationError
          error={generation.error}
          errorKind={generation.errorKind}
          onRetry={generation.retry}
        />
        {children}
      </>
    );
  }

  return children;
}
