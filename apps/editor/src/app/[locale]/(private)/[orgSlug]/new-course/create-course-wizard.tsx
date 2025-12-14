"use client";

import { useWizard } from "@zoonk/ui/hooks/use-wizard";
import { useLocale } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { createCourseAction } from "./actions";
import { DescriptionStep } from "./steps/description-step";
import { LanguageStep } from "./steps/language-step";
import { SlugStep } from "./steps/slug-step";
import { TitleStep } from "./steps/title-step";
import { useCourseForm } from "./use-course-form";
import { useWizardKeyboard } from "./use-wizard-keyboard";
import { WizardNavbar } from "./wizard-navbar";

const STEPS = ["title", "language", "description", "slug"] as const;

type CreateCourseWizardProps = {
  orgSlug: string;
};

export function CreateCourseWizard({ orgSlug }: CreateCourseWizardProps) {
  const router = useRouter();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slugExists, setSlugExists] = useState(false);

  const wizard = useWizard({ steps: STEPS });
  const { formData, updateField, canProceedFromStep } = useCourseForm({
    defaultLanguage: locale,
  });

  const canProceedFromField = canProceedFromStep(wizard.currentStepName);
  const canProceed =
    canProceedFromField && (wizard.currentStepName !== "slug" || !slugExists);

  const handleClose = useCallback(() => {
    router.push(`/${orgSlug}`);
  }, [router, orgSlug]);

  const handleNext = useCallback(() => {
    if (canProceed && !wizard.isLastStep) {
      wizard.goToNext();
    }
  }, [canProceed, wizard]);

  const handleSubmit = useCallback(() => {
    if (!canProceed) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createCourseAction(formData, orgSlug);

      if (result?.error) {
        setError(result.error);
      }
    });
  }, [canProceed, formData, orgSlug]);

  useWizardKeyboard({
    canProceed,
    currentStepName: wizard.currentStepName,
    isFirstStep: wizard.isFirstStep,
    isLastStep: wizard.isLastStep,
    onBack: wizard.goToPrevious,
    onClose: handleClose,
    onNext: handleNext,
    onSubmit: handleSubmit,
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <WizardNavbar
        canProceed={canProceed}
        currentStep={wizard.currentStep}
        isFirstStep={wizard.isFirstStep}
        isLastStep={wizard.isLastStep}
        isPending={isPending}
        onBack={wizard.goToPrevious}
        onClose={handleClose}
        onNext={handleNext}
        onSubmit={handleSubmit}
        totalSteps={wizard.totalSteps}
      />

      <div className="flex flex-1 flex-col items-start px-4 pt-8 lg:items-center lg:justify-center lg:pt-0">
        <div className="flex w-full max-w-xl flex-col gap-4">
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
              onSubmit={handleNext}
              value={formData.description}
            />
          )}

          {wizard.currentStepName === "slug" && (
            <SlugStep
              error={error}
              language={formData.language}
              onChange={(v) => updateField("slug", v)}
              onSlugExists={setSlugExists}
              orgSlug={orgSlug}
              title={formData.title}
              value={formData.slug}
            />
          )}
        </div>
      </div>
    </div>
  );
}
