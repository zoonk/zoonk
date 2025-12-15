"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Navbar } from "@zoonk/ui/components/navbar";
import { ProgressDots } from "@zoonk/ui/components/progress-dots";
import { Spinner } from "@zoonk/ui/components/spinner";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Link } from "@/i18n/navigation";

export function CreateCourseNavbar({
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  isPending,
  canProceed,
  orgSlug,
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
  orgSlug: string;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const t = useExtracted();

  return (
    <Navbar>
      <div className="flex flex-1 items-center gap-2">
        <Link
          className={buttonVariants({ size: "icon", variant: "secondary" })}
          href={`/${orgSlug}`}
        >
          <XIcon aria-hidden="true" />
          <span className="sr-only">{t("Close")}</span>
        </Link>

        <Button
          disabled={isFirstStep}
          onClick={onBack}
          size="icon"
          variant="outline"
        >
          <ChevronLeftIcon aria-hidden="true" />
          <span className="sr-only">{t("Back")}</span>
        </Button>
      </div>

      <ProgressDots current={currentStep} total={totalSteps} />

      <div className="flex flex-1 items-center justify-end gap-2">
        {isLastStep ? (
          <Button disabled={!canProceed || isPending} onClick={onSubmit}>
            {isPending && <Spinner aria-hidden="true" />}
            {t("Create")}
          </Button>
        ) : (
          <Button
            disabled={!canProceed || isPending}
            onClick={onNext}
            size="icon"
            variant="outline"
          >
            <ChevronRightIcon aria-hidden="true" />
            <span className="sr-only">{t("Next")}</span>
          </Button>
        )}
      </div>
    </Navbar>
  );
}
