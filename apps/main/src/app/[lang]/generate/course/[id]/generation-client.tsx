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
import { isGenerationInProgress } from "@/lib/workflow/generation-store";
import { useAnimatedProgress } from "@/lib/workflow/use-animated-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useThinkingMessages } from "@/lib/workflow/use-thinking-messages";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import {
  COURSE_COMPLETION_STEP,
  type CourseWorkflowStepName,
  INTRODUCTION_LESSON_COMPLETION_STEP,
} from "@zoonk/core/workflows/steps";
import { type GenerationStatus } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { API_URL } from "@zoonk/utils/url";
import { useExtracted } from "next-intl";
import { invalidateGeneratedCourse } from "./invalidate-generated-course";
import { useGenerationPhases } from "./use-generation-phases";

/**
 * Regular courses should leave the generation page when the intro lesson is
 * ready, while language courses have no intro chapter and should keep waiting
 * for the normal course completion step.
 */
function getCourseGenerationCompletionStep({
  isLanguageCourse,
}: {
  isLanguageCourse: boolean;
}): CourseWorkflowStepName {
  if (isLanguageCourse) {
    return COURSE_COMPLETION_STEP;
  }

  return INTRODUCTION_LESSON_COMPLETION_STEP;
}

export function GenerationClient({
  courseSlug,
  courseTitle,
  generationRunId,
  generationStatus,
  isLanguageCourse,
  linkedCourseSlug,
  requestId,
}: {
  courseSlug: string;
  courseTitle: string;
  generationRunId: string | null;
  generationStatus: GenerationStatus;
  isLanguageCourse: boolean;
  linkedCourseSlug: string | null;
  requestId: string;
}) {
  const t = useExtracted();
  const completionStep = getCourseGenerationCompletionStep({ isLanguageCourse });

  const generation = useWorkflowGeneration<CourseWorkflowStepName>({
    completionStep,
    initialRunId: generationRunId,
    initialStatus: generationStatus === "running" ? "streaming" : "idle",
    statusUrl: `${API_URL}/v1/workflows/course-generation/status`,
    triggerBody: { coursePromptId: requestId },
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
    isLanguageCourse,
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

  const redirectHref = `/b/${AI_ORG_SLUG}/c/${
    generation.completionEntityId ?? linkedCourseSlug ?? courseSlug
  }`;

  const completedTitle = isLanguageCourse ? t("Your course is ready") : t("Your lesson is ready");

  const completedSubtitle = isLanguageCourse
    ? t("Taking you to your course...")
    : t("Taking you to your lesson...");

  useCompletionRedirect({
    beforeRedirect: () => invalidateGeneratedCourse(redirectHref),
    status: generation.status,
    url: redirectHref,
  });

  if (isActive) {
    return (
      <GenerationTimeline>
        <GenerationTimelineHeader>
          <GenerationTimelineTitle>
            {t("Creating the {title} course", { title: courseTitle })}
          </GenerationTimelineTitle>
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
      <GenerationProgressCompleted subtitle={completedSubtitle}>
        {completedTitle}
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
