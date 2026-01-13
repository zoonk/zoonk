"use client";

import type { GenerationStatus } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import {
  GenerationProgressCompleted,
  GenerationProgressCompletedStep,
  GenerationProgressCompletedSteps,
  GenerationProgressError,
  GenerationProgressStreaming,
  GenerationProgressTriggering,
} from "@/components/generation/generation-progress";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import type { StepName } from "@/workflows/course-generation/types";
import { STEP_ICONS } from "./generation-step-icons";
import { useGenerationStepLabels } from "./use-generation-step-labels";

type GenerationClientProps = {
  courseSlug: string;
  generationRunId: string | null;
  generationStatus: GenerationStatus;
  locale: string;
  suggestionId: number;
};

export function GenerationClient({
  courseSlug,
  generationRunId,
  generationStatus,
  locale,
  suggestionId,
}: GenerationClientProps) {
  const t = useExtracted();
  const router = useRouter();
  const { getLabel } = useGenerationStepLabels();

  const generation = useWorkflowGeneration<StepName>({
    initialRunId: generationRunId,
    initialStatus: generationStatus === "running" ? "streaming" : "idle",
    statusUrl: "/api/workflows/course-generation/status",
    triggerBody: { courseSuggestionId: suggestionId },
    triggerUrl: "/api/workflows/course-generation/trigger",
  });

  // Redirect when completed
  useEffect(() => {
    if (generation.status !== "completed") {
      return;
    }

    const timer = setTimeout(() => {
      router.push(`/${locale}/b/${AI_ORG_SLUG}/c/${courseSlug}`);
    }, 1500);

    return () => clearTimeout(timer);
  }, [generation.status, courseSlug, locale, router]);

  if (generation.status === "triggering") {
    return (
      <GenerationProgressTriggering>
        {t("Starting generation...")}
      </GenerationProgressTriggering>
    );
  }

  if (generation.status === "streaming") {
    const CurrentIcon = generation.currentStep
      ? STEP_ICONS[generation.currentStep]
      : null;

    return (
      <GenerationProgressStreaming
        completedSteps={
          generation.completedSteps.length > 0 ? (
            <GenerationProgressCompletedSteps>
              {generation.completedSteps.map((step) => (
                <GenerationProgressCompletedStep key={step}>
                  {getLabel(step)}
                </GenerationProgressCompletedStep>
              ))}
            </GenerationProgressCompletedSteps>
          ) : undefined
        }
        icon={CurrentIcon ? <CurrentIcon /> : undefined}
      >
        {generation.currentStep
          ? getLabel(generation.currentStep)
          : t("Processing...")}
      </GenerationProgressStreaming>
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
