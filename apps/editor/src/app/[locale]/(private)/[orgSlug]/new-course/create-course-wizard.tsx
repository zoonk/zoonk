"use client";

import {
  useWizard,
  useWizardKeyboard,
  WizardContent,
} from "@zoonk/ui/components/wizard";
import { toSlug } from "@zoonk/utils/string";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { createCourseAction } from "./actions";
import { CreateCourseNavbar } from "./create-course-navbar";
import { DescriptionStep } from "./steps/description-step";
import { LanguageStep } from "./steps/language-step";
import { SlugStep } from "./steps/slug-step";
import { TitleStep } from "./steps/title-step";
import { useCourseForm } from "./use-course-form";

const STEPS = ["title", "language", "description", "slug"] as const;

export function CreateCourseWizard({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const wizard = useWizard({ steps: STEPS });

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { formData, updateField, canProceedFromStep, getStepError } =
    useCourseForm({ orgSlug });

  const canProceed = canProceedFromStep(wizard.currentStepName);

  const handleClose = useCallback(() => {
    router.push(`/${orgSlug}`);
  }, [router, orgSlug]);

  const handleNext = useCallback(() => {
    if (!canProceed || wizard.isLastStep) {
      return;
    }

    // Auto-fill slug from title when entering the slug step
    if (wizard.currentStepName === "description" && !formData.slug) {
      updateField("slug", toSlug(formData.title));
    }

    wizard.goToNext();
  }, [canProceed, formData.slug, formData.title, updateField, wizard]);

  const handleSubmit = useCallback(() => {
    if (!canProceed || isPending) {
      return;
    }

    setSubmitError(null);

    startTransition(async () => {
      const result = await createCourseAction(formData, orgSlug);

      if (result?.error) {
        setSubmitError(result.error);
      }
    });
  }, [canProceed, formData, isPending, orgSlug]);

  useWizardKeyboard({
    canProceed,
    isFirstStep: wizard.isFirstStep,
    isLastStep: wizard.isLastStep,
    onBack: wizard.goToPrevious,
    onClose: handleClose,
    onNext: handleNext,
    onSubmit: handleSubmit,
  });

  return (
    <>
      <CreateCourseNavbar
        canProceed={canProceed}
        currentStep={wizard.currentStep}
        isFirstStep={wizard.isFirstStep}
        isLastStep={wizard.isLastStep}
        isPending={isPending}
        onBack={wizard.goToPrevious}
        onNext={handleNext}
        onSubmit={handleSubmit}
        orgSlug={orgSlug}
        totalSteps={wizard.totalSteps}
      />

      <WizardContent>
        {wizard.currentStepName === "title" && (
          <TitleStep
            onChange={(v) => updateField("title", v)}
            value={formData.title}
          />
        )}

        {wizard.currentStepName === "language" && (
          <LanguageStep
            onChange={(v) => updateField("language", v)}
            value={formData.language}
          />
        )}

        {wizard.currentStepName === "description" && (
          <DescriptionStep
            onChange={(v) => updateField("description", v)}
            value={formData.description}
          />
        )}

        {wizard.currentStepName === "slug" && (
          <SlugStep
            error={submitError || getStepError("slug")}
            onChange={(v) => updateField("slug", v)}
            value={formData.slug}
          />
        )}
      </WizardContent>
    </>
  );
}
