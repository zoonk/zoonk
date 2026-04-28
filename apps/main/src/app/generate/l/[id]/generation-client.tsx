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
import { type GeneratedLessonKind } from "@/lib/generation/lesson-generation-phase-config";
import { type GenerationStatus } from "@/lib/workflow/generation-store";
import { useAnimatedProgress } from "@/lib/workflow/use-animated-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useThinkingMessages } from "@/lib/workflow/use-thinking-messages";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import { LESSON_COMPLETION_STEP, type LessonStepName } from "@zoonk/core/workflows/steps";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { API_URL } from "@zoonk/utils/url";
import { useExtracted } from "next-intl";
import { useGenerationPhases } from "./use-generation-phases";

export function GenerationClient({
  chapterSlug,
  courseSlug,
  generationRunId,
  initialStatus,
  lessonId,
  lessonKind,
  lessonSlug,
}: {
  chapterSlug: string;
  courseSlug: string;
  generationRunId: string | null;
  initialStatus: GenerationStatus;
  lessonId: string;
  lessonKind: GeneratedLessonKind;
  lessonSlug: string;
}) {
  const t = useExtracted();

  const generation = useWorkflowGeneration<LessonStepName>({
    completionStep: LESSON_COMPLETION_STEP,
    initialRunId: generationRunId,
    initialStatus,
    statusUrl: `${API_URL}/v1/workflows/lesson-generation/status`,
    triggerBody: { lessonId },
    triggerUrl: `${API_URL}/v1/workflows/lesson-generation/trigger`,
  });

  const { activePhaseNames, phases, progress, targetProgress, thinkingGenerators } =
    useGenerationPhases(
      generation.completedSteps,
      generation.currentStep,
      lessonKind,
      generation.startedSteps,
    );

  const isActive = generation.status === "triggering" || generation.status === "streaming";
  const displayProgress = useAnimatedProgress({ isActive, realProgress: progress, targetProgress });
  const thinkingMessages = useThinkingMessages(
    thinkingGenerators,
    isActive ? activePhaseNames : [],
  );

  useCompletionRedirect({
    status: generation.status,
    url: `/b/${AI_ORG_SLUG}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`,
  });

  if (isActive) {
    return (
      <GenerationTimeline>
        <GenerationTimelineHeader>
          <GenerationTimelineTitle>{t("Creating your lesson")}</GenerationTimelineTitle>
          <GenerationTimelineSubtitle>
            {t("This usually takes a few seconds")}
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
      <GenerationProgressCompleted subtitle={t("Taking you to your lesson...")}>
        {t("Your lesson is ready")}
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
