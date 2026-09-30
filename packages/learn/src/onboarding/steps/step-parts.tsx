"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type LucideIcon } from "lucide-react";
import { OnboardingColumn } from "../onboarding-frame";

/**
 * A few short promises before a step starts (no timer, stop anytime), each icon on its item's
 * first line however the item wraps.
 */
export function StepPoints({ points }: { points: { icon: LucideIcon; label: string }[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {points.map(({ icon: Icon, label }) => (
        <li className="flex items-start gap-3 text-pretty" key={label}>
          <span aria-hidden="true" className="flex h-lh shrink-0 items-center">
            <Icon className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 size-5" />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The large icon that opens a finished or changed moment, such as placement being done; `success`
 * colors it as done (Fun's lime tile).
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
        "bg-muted in-data-[mode=fun]:bg-fun-soft flex size-14 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-7",
        success &&
          "text-success in-data-[mode=fun]:bg-fun-lime in-data-[mode=fun]:text-fun-lime-foreground",
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
