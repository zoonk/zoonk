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
import { type GenerationReturnTo } from "@/lib/workflow/generation-return-to";
import { type GenerationErrorKind, isGenerationInProgress } from "@/lib/workflow/generation-store";
import { useAnimatedProgress } from "@/lib/workflow/use-animated-progress";
import { useCompletionRedirect } from "@/lib/workflow/use-completion-redirect";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import { COURSE_COMPLETION_STEP, type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type GenerationStatus } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { useExtracted, useLocale } from "next-intl";
import { type ReactNode } from "react";
import { finishGenerationRequest } from "../../finish-generation-request";
import { invalidateGeneratedCourse } from "./invalidate-generated-course";
import { useCoursePromptReconciliation } from "./use-course-prompt-reconciliation";
import { useGenerationPhases } from "./use-generation-phases";

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

function CourseGenerationCompleted({ returnTo }: { returnTo: GenerationReturnTo | null }) {
  const t = useExtracted();

  return (
    <GenerationProgressCompleted
      subtitle={returnTo ? t("Opening your next step…") : t("Taking you to your course...")}
    >
      {t("Your course is ready")}
    </GenerationProgressCompleted>
  );
}

function getDestinationSlug(slugs: (string | null | undefined)[]): string {
  return slugs.find((slug) => Boolean(slug)) ?? "";
}

export function GenerationClient({
  canGenerate,
  children,
  courseSlug,
  courseTitle,
  generationRunId,
  generationStatus,
  linkedCourseSlug,
  requestId,
  returnTo,
}: {
  canGenerate: boolean;
  children: ReactNode;
  courseSlug: string;
  courseTitle: string;
  generationRunId: string | null;
  generationStatus: GenerationStatus;
  linkedCourseSlug: string | null;
  requestId: string;
  returnTo: GenerationReturnTo | null;
}) {
  const t = useExtracted();
  const locale = useLocale();

  const generation = useWorkflowGeneration<CourseWorkflowStepName>({
    autoTrigger: canGenerate,
    completionStep: COURSE_COMPLETION_STEP,
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

  const { activePhaseDurationMs, phases, progress, targetProgress } = useGenerationPhases(
    generation.completedSteps,
    generation.currentStep,
    generation.startedSteps,
  );

  const isActive = isGenerationInProgress(status) && !reconciliation.hasError;

  const displayProgress = useAnimatedProgress({
    estimatedDurationMs: activePhaseDurationMs,
    isActive,
    realProgress: progress,
    targetProgress,
  });

  const destinationSlug = getDestinationSlug([
    reconciliation.target?.courseSlug,
    generation.completionEntityId,
    linkedCourseSlug,
    courseSlug,
  ]);

  const redirectHref = getPathname({
    href: returnTo ?? `/b/${AI_ORG_SLUG}/c/${destinationSlug}/start`,
    locale,
  });

  const generationHref = `/generate/course/${requestId}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;

  const returnHref = getPathname({ forcePrefix: true, href: generationHref, locale });

  const loginHref = `/login?next=${encodeURIComponent(returnHref)}` as const;

  useCompletionRedirect({
    beforeRedirect: async () => {
      await invalidateGeneratedCourse(redirectHref);

      if (!returnTo) {
        return;
      }

      const href = await finishGenerationRequest(returnTo);
      return href ? getPathname({ href, locale }) : undefined;
    },
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
              {t("This may take a few minutes")}
            </GenerationTimelineSubtitle>
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
        {children}
      </>
    );
  }

  if (status === "completed") {
    return <CourseGenerationCompleted returnTo={returnTo} />;
  }

  if (status === "limitReached" && generation.limit) {
    return (
      <GenerationLimitCTA
        backHref={returnTo ?? "/"}
        backLabel={returnTo ? t("Back") : t("Back home")}
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
