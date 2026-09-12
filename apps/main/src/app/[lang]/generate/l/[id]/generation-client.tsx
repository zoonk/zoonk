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
import {
  type GenerationBackTo,
  type GenerationReturnTo,
  getGenerationNavigationQuery,
} from "@/lib/workflow/generation-return-to";
import { type GenerationStatus, isGenerationInProgress } from "@/lib/workflow/generation-store";
import { useAnimatedProgress } from "@/lib/workflow/use-animated-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useThinkingMessages } from "@/lib/workflow/use-thinking-messages";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import { type GeneratedLessonKind } from "@zoonk/core/lessons/generated-companion-kinds";
import { LESSON_COMPLETION_STEP, type LessonStepName } from "@zoonk/core/workflows/steps";
import { useExtracted, useLocale } from "next-intl";
import { type ReactNode } from "react";
import { useGenerationPhases } from "./use-generation-phases";

export function GenerationClient({
  brandSlug,
  backTo,
  returnTo,
  chapterSlug,
  children,
  courseSlug,
  generationRunId,
  initialStatus,
  invalidateContent,
  lessonId,
  lessonKind,
  lessonSlug,
  lessonTitle,
}: {
  brandSlug: string;
  backTo: GenerationBackTo | null;
  returnTo: GenerationReturnTo | null;
  chapterSlug: string;
  children: ReactNode;
  courseSlug: string;
  generationRunId: string | null;
  initialStatus: GenerationStatus;
  invalidateContent: () => Promise<void>;
  lessonId: string;
  lessonKind: GeneratedLessonKind;
  lessonSlug: string;
  lessonTitle: string;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const backHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
  const querySuffix = getGenerationNavigationQuery({ backTo, returnTo });
  const generationHref = `/generate/l/${lessonId}${querySuffix}`;
  const loginHref = `/login?next=${encodeURIComponent(generationHref)}` as const;

  const generation = useWorkflowGeneration<LessonStepName>({
    completionStep: LESSON_COMPLETION_STEP,
    initialRunId: generationRunId,
    initialStatus,
    target: { id: lessonId, type: "lesson" },
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
    lessonKind,
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
      href: returnTo ?? `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`,
      locale,
    }),
  });

  if (isActive) {
    return (
      <>
        <GenerationTimeline>
          <GenerationTimelineHeader>
            <GenerationTimelineTitle>
              {t("Creating the {title} lesson", { title: lessonTitle })}
            </GenerationTimelineTitle>
            <GenerationTimelineSubtitle>
              {t("This usually takes 1-2 minutes")}
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
      <GenerationProgressCompleted
        subtitle={returnTo ? t("Opening your next step…") : t("Taking you to your lesson...")}
      >
        {t("Your lesson is ready")}
      </GenerationProgressCompleted>
    );
  }

  if (generation.status === "limitReached" && generation.limit) {
    return (
      <GenerationLimitCTA
        backHref={returnTo ?? backTo ?? backHref}
        backLabel={returnTo ? t("Back") : t("Back to chapter")}
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
