"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck } from "lucide-react";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { type CompletionResult } from "../completion-input-schema";
import { usePlayer } from "../player-context";
import { type DimensionInventory } from "../player-reducer";
import { BeltProgressHint, BeltProgressSkeleton } from "./belt-progress";
import { DimensionList, buildDimensionEntries } from "./dimension-inventory";
import { RewardBadges, RewardBadgesSkeleton } from "./reward-badges";

function ChallengeScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "animate-in fade-in mx-auto flex w-full max-w-lg flex-col items-center gap-6 duration-200 ease-out motion-reduce:animate-none",
        className,
      )}
      data-slot="completion-screen"
      role="status"
      {...props}
    />
  );
}

function ChallengeActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full flex-col gap-3", className)}
      data-slot="completion-actions"
      {...props}
    />
  );
}

function ChallengeRewardBadges({
  completionResult,
  isSuccess,
}: {
  completionResult: CompletionResult | null;
  isSuccess: boolean;
}) {
  if (!completionResult || completionResult.status !== "success") {
    return (
      <>
        <RewardBadgesSkeleton />
        {isSuccess && <BeltProgressSkeleton />}
      </>
    );
  }

  return (
    <>
      <RewardBadges
        brainPower={completionResult.brainPower}
        energyDelta={completionResult.energyDelta}
        isChallenge={isSuccess}
      />
      {isSuccess && (
        <BeltProgressHint
          brainPower={completionResult.brainPower}
          newTotalBp={completionResult.newTotalBp}
        />
      )}
    </>
  );
}

export function ChallengeSuccessContent({
  children,
  completionResult,
  dimensions,
}: {
  children: React.ReactNode;
  completionResult: CompletionResult | null;
  dimensions: DimensionInventory;
}) {
  const t = useExtracted();
  const { completionFooter } = usePlayer();
  const entries = buildDimensionEntries(dimensions, []);

  return (
    <ChallengeScreen>
      <div className="flex flex-col items-center gap-2">
        <CircleCheck className="text-foreground size-12" />
        <p className="text-lg font-medium">{t("Challenge Complete")}</p>
      </div>

      <DimensionList aria-label={t("Final dimension scores")} entries={entries} variant="success" />

      <ChallengeRewardBadges completionResult={completionResult} isSuccess />

      {children}

      {completionFooter}
    </ChallengeScreen>
  );
}

export function ChallengeFailureContent({
  completionResult,
  dimensions,
  lessonHref,
  onRestart,
}: {
  completionResult: CompletionResult | null;
  dimensions: DimensionInventory;
  lessonHref: string;
  onRestart: () => void;
}) {
  const t = useExtracted();
  const { completionFooter } = usePlayer();
  const entries = buildDimensionEntries(dimensions, []);

  return (
    <ChallengeScreen>
      <div className="flex w-full flex-col gap-1">
        <p className="text-2xl font-bold tracking-tight">{t("Challenge Failed")}</p>
        <p className="text-muted-foreground text-sm">{t("Some of your stats went below zero.")}</p>
      </div>

      <DimensionList aria-label={t("Final dimension scores")} entries={entries} variant="failure" />

      <ChallengeRewardBadges completionResult={completionResult} isSuccess={false} />

      <ChallengeActions>
        <Button className="w-full lg:justify-between" onClick={onRestart} size="lg">
          {t("Try Again")}
          <Kbd className="bg-primary-foreground/15 text-primary-foreground hidden opacity-70 lg:inline-flex">
            R
          </Kbd>
        </Button>

        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-full lg:justify-between")}
          href={lessonHref}
        >
          {t("Back to Lesson")}
          <Kbd className="hidden opacity-60 lg:inline-flex">Esc</Kbd>
        </Link>
      </ChallengeActions>

      {completionFooter}
    </ChallengeScreen>
  );
}
