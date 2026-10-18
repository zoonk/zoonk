"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { OnboardingColumn } from "../onboarding-frame";

/**
 * An action inside a sentence of a step (the plan's reveal: "Use 1h 40 a day", "Use this date"): a
 * word of it, underlined, as tall as its line.
 */
export const INLINE_ACTION_CLASS =
  "text-foreground decoration-foreground/30 hover:decoration-foreground focus-visible:ring-ring/50 rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-[3px] disabled:opacity-50";

/**
 * The icon that opens a finished or changed moment, such as placement being done: a bare glyph
 * over the title, no tile; `success` colors it as done.
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
        "text-muted-foreground flex shrink-0 [&_svg]:size-6",
        success && "text-success-text",
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
