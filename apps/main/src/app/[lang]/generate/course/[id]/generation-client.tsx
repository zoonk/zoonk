"use client";

import { GenerationLimitCTA } from "@/components/generation/generation-limit-cta";
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
import { getPathname } from "@/i18n/navigation";
import { type GenerationErrorKind, isGenerationInProgress } from "@/lib/workflow/generation-store";
import { useAnimatedProgress } from "@/lib/workflow/use-animated-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useThinkingMessages } from "@/lib/workflow/use-thinking-messages";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import { type CoursePromptGenerationCompletionKind } from "@zoonk/core/courses/get-prompt-generation";
import {
  COURSE_COMPLETION_STEP,
  type CourseWorkflowStepName,
  INTRODUCTION_LESSON_COMPLETION_STEP,
} from "@zoonk/core/workflows/steps";
import { type GenerationStatus } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { useExtracted, useLocale } from "next-intl";
import { type ReactNode } from "react";
import { invalidateGeneratedCourse } from "./invalidate-generated-course";
import { useCoursePromptReconciliation } from "./use-course-prompt-reconciliation";
import { useGenerationPhases } from "./use-generation-phases";

/**
 * Maps the core-owned completion capability to the workflow event that drives
 * this web client's progress and hard-navigation choreography.
 */
function getCourseGenerationCompletionStep({
  completionKind,
}: {
  completionKind: CoursePromptGenerationCompletionKind;
}): CourseWorkflowStepName {
  if (completionKind === "course") {
    return COURSE_COMPLETION_STEP;
  }

  return INTRODUCTION_LESSON_COMPLETION_STEP;
}

function getReadyTargetPath(target: ReturnType<typeof useCoursePromptReconciliation>["target"]) {
  if (!target) {
    return null;
  }

  if (target.kind === "course") {
    return `${target.courseSlug}?edition=original`;
  }

  return `${target.courseSlug}/ch/${target.chapterSlug}/l/${target.lessonSlug}`;
}

function getCompletionTargetPath({
  completionEntityId,
  completionKind,
  courseSlug,
  linkedCourseSlug,
}: {
  completionEntityId: string | null;
  completionKind: CoursePromptGenerationCompletionKind;
  courseSlug: string;
  linkedCourseSlug: string | null;
}) {
  const target = completionEntityId ?? linkedCourseSlug ?? courseSlug;

  if (completionKind === "course" || !completionEntityId) {
    return `${target}?edition=original`;
  }

  return target;
}

/** Viewing an existing run is public; retrying generation requires a session. */
function retryCourseGeneration({
  canGenerate,
  errorKind,
  loginHref,
  onRetry,
  reload,
}: {
  canGenerate: boolean;
  errorKind: GenerationErrorKind | null;
  loginHref: string;
  onRetry: () => void;
  reload: boolean;
}) {
  if (!canGenerate && errorKind !== "connection") {
    globalThis.location.href = loginHref;
    return;
  }

  if (reload) {
    globalThis.location.reload();
    return;
  }

  onRetry();
}

function CourseGenerationCompleted({ isLanguageCourse }: { isLanguageCourse: boolean }) {
  const t = useExtracted();

  return (
    <GenerationProgressCompleted
      subtitle={
        isLanguageCourse ? t("Taking you to your course...") : t("Taking you to your first lesson…")
      }
    >
      {isLanguageCourse ? t("Your course is ready") : t("Your lesson is ready")}
    </GenerationProgressCompleted>
  );
}

export function GenerationClient({
  canGenerate,
  children,
  completionKind,
  courseSlug,
  courseTitle,
  generationRunId,
  generationStatus,
  isLanguageCourse,
  linkedCourseSlug,
  requestId,
}: {
  canGenerate: boolean;
  children: ReactNode;
  completionKind: CoursePromptGenerationCompletionKind;
  courseSlug: string;
  courseTitle: string;
  generationRunId: string | null;
  generationStatus: GenerationStatus;
  isLanguageCourse: boolean;
  linkedCourseSlug: string | null;
  requestId: string;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const completionStep = getCourseGenerationCompletionStep({ completionKind });

  const generation = useWorkflowGeneration<CourseWorkflowStepName>({
    autoTrigger: canGenerate,
    completionStep,
    initialRunId: generationRunId,
    initialStatus: generationStatus === "running" && generationRunId ? "streaming" : "idle",
    target: { id: requestId, type: "coursePrompt" },
  });

  const reconciliation = useCoursePromptReconciliation({
    onResume: generation.resume,
    requestId,
    runId: generation.runId,
    status: generation.status,
  });

  const status = reconciliation.target ? "completed" : generation.status;

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

  const isActive = isGenerationInProgress(status) && !reconciliation.hasError;

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

  const completionPath = getCompletionTargetPath({
    completionEntityId: generation.completionEntityId,
    completionKind,
    courseSlug,
    linkedCourseSlug,
  });

  const destinationTarget = getReadyTargetPath(reconciliation.target) ?? completionPath;

  const redirectHref = getPathname({ href: `/b/${AI_ORG_SLUG}/c/${destinationTarget}`, locale });

  const returnHref = getPathname({
    forcePrefix: true,
    href: `/generate/course/${requestId}`,
    locale,
  });

  const loginHref = `/login?next=${encodeURIComponent(returnHref)}` as const;

  useCompletionRedirect({
    beforeRedirect: () => invalidateGeneratedCourse(redirectHref),
    status,
    url: redirectHref,
  });

  if (isActive) {
    return (
      <>
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
        {children}
      </>
    );
  }

  if (status === "completed") {
    return <CourseGenerationCompleted isLanguageCourse={isLanguageCourse} />;
  }

  if (status === "limitReached" && generation.limit) {
    return (
      <GenerationLimitCTA
        backHref="/"
        backLabel={t("Back home")}
        limit={generation.limit}
        loginHref={loginHref}
      />
    );
  }

  if (status === "error" || reconciliation.hasError) {
    return (
      <>
        <WorkflowGenerationError
          error={reconciliation.hasError ? null : generation.error}
          errorKind={reconciliation.errorKind ?? generation.errorKind}
          onRetry={() =>
            retryCourseGeneration({
              canGenerate,
              errorKind: reconciliation.errorKind ?? generation.errorKind,
              loginHref: getPathname({ forcePrefix: true, href: loginHref, locale }),
              onRetry: generation.retry,
              reload: reconciliation.hasError,
            })
          }
        />
        {children}
      </>
    );
  }

  return children;
}
