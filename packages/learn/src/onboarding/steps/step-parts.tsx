"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingTitle,
} from "../onboarding-frame";

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
      <OnboardingHeading>
        <OnboardingTitle>
          {t({
            description:
              "Headline when a screen failed to load. Next to it is a “Try again” button.",
            message: "This didn't open",
          })}
        </OnboardingTitle>
        <OnboardingDescription role="alert">
          {t("Something went wrong on our side.")}
        </OnboardingDescription>
      </OnboardingHeading>

      <OnboardingFooter>
        <OnboardingPrimaryButton busy={retrying} onClick={() => startRetrying(onRetry)}>
          {t("Try again")}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
