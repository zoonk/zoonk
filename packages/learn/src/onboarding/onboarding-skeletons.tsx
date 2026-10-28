"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { SendingGoal } from "./entry/understanding-wait";
import { OnboardingHowItWorks } from "./how-it-works";
import { BAR_MIDDLE_CLASS } from "./onboarding-bar";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFrame,
  OnboardingHeading,
  OnboardingTitle,
} from "./onboarding-frame";
import { OnboardingRailProvider } from "./onboarding-rail";
import { StartOverMenuSkeleton } from "./start-over-menu";

const EXAMPLE_ROWS = 5;

const ROW_WIDTHS = ["w-3/5", "w-4/5", "w-1/2", "w-2/3", "w-3/4"];

function RowsSkeleton({ rows, twoLines = false }: { rows: number; twoLines?: boolean }) {
  return (
    <div className="flex flex-col [&>*+*]:border-t">
      {Array.from({ length: rows }, (_, index) => (
        <div
          className={cn("flex flex-col justify-center gap-1.5", twoLines ? "min-h-14" : "min-h-11")}
          // oxlint-disable-next-line react/no-array-index-key -- Placeholders are positions, not items.
          key={index}
        >
          <Skeleton className={cn("h-3.5", ROW_WIDTHS[index % ROW_WIDTHS.length])} />
          {twoLines && <Skeleton className="h-3 w-1/4" />}
        </div>
      ))}
    </div>
  );
}

function RailSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3 w-24" />
      <RowsSkeleton rows={3} />
    </div>
  );
}

function HeadingSkeleton({ eyebrow = false }: { eyebrow?: boolean }) {
  return (
    <OnboardingHeading>
      {eyebrow && <Skeleton className="h-4 w-32" data-slot="page-eyebrow" />}
      <Skeleton className="h-16.5 w-4/5 sm:h-8.25" />
      <Skeleton className="mt-1 h-5 w-3/5" />
    </OnboardingHeading>
  );
}

export function StartEntrySkeleton() {
  const t = useExtracted();

  return (
    <OnboardingRailProvider rail={<RailSkeleton />}>
      <OnboardingFrame>
        <OnboardingColumn aria-busy="true">
          <OnboardingHeading>
            <OnboardingTitle>{t("What do you want to achieve?")}</OnboardingTitle>
            <OnboardingDescription>
              {t("Tell us in your own words. We'll build the plan.")}
            </OnboardingDescription>
          </OnboardingHeading>

          <Skeleton className="@container w-full p-1.5 pl-4">
            <div className="h-24 @xl:h-11" />
          </Skeleton>

          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-20" />
            <RowsSkeleton rows={EXAMPLE_ROWS} twoLines />
          </div>
        </OnboardingColumn>
      </OnboardingFrame>
    </OnboardingRailProvider>
  );
}

export function StartSentGoal({ goal, hasAccount }: { goal: string; hasAccount: boolean }) {
  return (
    <OnboardingRailProvider rail={<OnboardingHowItWorks hasAccount={hasAccount} />}>
      <OnboardingFrame>
        <SendingGoal goal={goal} />
      </OnboardingFrame>
    </OnboardingRailProvider>
  );
}

export function StartWaitSkeleton() {
  return (
    <OnboardingRailProvider rail={<RailSkeleton />}>
      <OnboardingFrame>
        <OnboardingColumn aria-busy="true">
          <Skeleton className="h-11 w-3/5 self-end rounded-xl rounded-br-sm" />

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <HeadingSkeleton />
              <Skeleton className="h-4 w-full" />
            </div>

            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          </div>
        </OnboardingColumn>
      </OnboardingFrame>
    </OnboardingRailProvider>
  );
}

export function StepsSkeleton() {
  return (
    <OnboardingRailProvider rail={<RailSkeleton />}>
      <OnboardingFrame
        bar={{
          end: <StartOverMenuSkeleton />,
          middle: <Skeleton className={cn("h-1", BAR_MIDDLE_CLASS)} />,
        }}
      >
        <OnboardingColumn aria-busy="true">
          <HeadingSkeleton eyebrow />
          <RowsSkeleton rows={4} twoLines />
        </OnboardingColumn>
      </OnboardingFrame>
    </OnboardingRailProvider>
  );
}
