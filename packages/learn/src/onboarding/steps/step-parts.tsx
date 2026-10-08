"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { OnboardingColumn } from "../onboarding-frame";

/**
 * The large icon that opens a finished or changed moment, such as placement being done; `success`
 * colors it as done.
 */
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
        "bg-muted flex size-14 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-7",
        success && "text-success",
      )}
    >
      {children}
    </span>
  );
}

/** While a step reads where the learner was, so a refresh doesn't flash its start screen. */
export function StepLoading() {
  return (
    <OnboardingColumn aria-busy="true">
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-2/3" />
    </OnboardingColumn>
  );
}
