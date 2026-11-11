"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { RotateCwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { StepOpenFailed } from "../../_components/step-open-failed";
import { OnboardingColumn, OnboardingFooter, OnboardingPrimaryButton } from "../onboarding-frame";

export function StepIcon({
  children,
  success = false,
}: {
  children: React.ReactNode;
  success?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-muted-foreground flex shrink-0 [&_svg]:size-6",
        success && "text-success-text",
      )}
    >
      {children}
    </span>
  );
}

export function StepLoading() {
  return (
    <OnboardingColumn aria-busy="true">
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-2/3" />
    </OnboardingColumn>
  );
}

export function StepLoadFailed({ onRetry }: { onRetry: () => Promise<void> }) {
  const t = useExtracted();
  const [retrying, startRetrying] = useTransition();

  return (
    <OnboardingColumn>
      {!retrying && <StepOpenFailed className="text-sm" />}

      <OnboardingFooter>
        <OnboardingPrimaryButton
          busy={retrying}
          icon={<RotateCwIcon aria-hidden="true" />}
          onClick={() => startRetrying(onRetry)}
        >
          {t("Try again")}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
