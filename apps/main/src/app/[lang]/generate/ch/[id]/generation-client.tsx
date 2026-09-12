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
import { getOriginalCourseHref } from "@/data/courses/course-href";
import { getPathname } from "@/i18n/navigation";
import { type GenerationReturnTo } from "@/lib/workflow/generation-return-to";
import { type GenerationStatus, isGenerationInProgress } from "@/lib/workflow/generation-store";
import { useAnimatedProgress } from "@/lib/workflow/use-animated-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useThinkingMessages } from "@/lib/workflow/use-thinking-messages";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import { CHAPTER_COMPLETION_STEP, type ChapterWorkflowStepName } from "@zoonk/core/workflows/steps";
import { useExtracted, useLocale } from "next-intl";
import { type ReactNode } from "react";
import { useGenerationPhases } from "./use-generation-phases";

export function GenerationClient({
  brandSlug,
  returnTo,
  chapterId,
  chapterSlug,
  chapterTitle,
  children,
  courseSlug,
  generationRunId,
  initialStatus,
  invalidateContent,
}: {
  brandSlug: string;
  returnTo: GenerationReturnTo | null;
  chapterId: string;
  chapterSlug: string;
  chapterTitle: string;
  children: ReactNode;
  courseSlug: string;
  generationRunId: string | null;
  initialStatus: GenerationStatus;
  invalidateContent: () => Promise<string | null>;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const backHref = getOriginalCourseHref({ brandSlug, courseSlug });
  const generationHref = `/generate/ch/${chapterId}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  const loginHref = `/login?next=${encodeURIComponent(generationHref)}` as const;

  const generation = useWorkflowGeneration<ChapterWorkflowStepName>({
    completionStep: CHAPTER_COMPLETION_STEP,
    initialRunId: generationRunId,
    initialStatus,
    target: { id: chapterId, type: "chapter" },
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
    url: getPathname({
      href: returnTo ?? `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}`,
      locale,
    }),
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
      <GenerationProgressCompleted subtitle={t("Opening your next step…")}>
        {t("Your chapter is ready")}
      </GenerationProgressCompleted>
    );
  }

  if (generation.status === "limitReached" && generation.limit) {
    return (
      <GenerationLimitCTA
        backHref={returnTo ?? backHref}
        backLabel={returnTo ? t("Back") : t("Back to course")}
        limit={generation.limit}
        loginHref={loginHref}
      />
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
