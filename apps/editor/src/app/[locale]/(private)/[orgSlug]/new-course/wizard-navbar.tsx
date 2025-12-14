"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { ProgressDots } from "@zoonk/ui/components/progress-dots";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export function WizardNavbar({
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  isPending,
  canProceed,
  onClose,
  onBack,
  onNext,
  onSubmit,
}: {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  isPending: boolean;
  canProceed: boolean;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const t = useExtracted();

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-background/80 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        {isFirstStep ? (
          <button
            className={cn(buttonVariants({ size: "icon", variant: "outline" }))}
            onClick={onClose}
            type="button"
          >
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("Close")}</span>
          </button>
        ) : (
          <button
            className={cn(buttonVariants({ size: "icon", variant: "outline" }))}
            onClick={onBack}
            type="button"
          >
            <ChevronLeftIcon aria-hidden="true" />
            <span className="sr-only">{t("Back")}</span>
          </button>
        )}
      </div>

      <ProgressDots current={currentStep} total={totalSteps} />

      <div className="flex items-center gap-2">
        {isLastStep ? (
          <button
            className={cn(
              buttonVariants({ size: "default", variant: "default" }),
            )}
            disabled={!canProceed || isPending}
            onClick={onSubmit}
            type="button"
          >
            {isPending ? <Spinner /> : null}
            {t("Create")}
          </button>
        ) : (
          <button
            className={cn(buttonVariants({ size: "icon", variant: "outline" }))}
            disabled={!canProceed}
            onClick={onNext}
            type="button"
          >
            <ChevronRightIcon aria-hidden="true" />
            <span className="sr-only">{t("Next")}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
