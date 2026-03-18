"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type Route } from "next";
import { useExtracted } from "next-intl";
import { type CompletionResult } from "../completion-input-schema";
import { usePlayer } from "../player-context";
import { type DimensionInventory } from "../player-reducer";
import { BeltProgressHint, BeltProgressSkeleton } from "./belt-progress";
import { PrimaryKbd, SecondaryActionLink } from "./completion-action-link";
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

function VictoryHighlight({ dimensions }: { dimensions: DimensionInventory }) {
  const t = useExtracted();
  const total = Object.values(dimensions).reduce((sum, value) => sum + value, 0);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="animate-in zoom-in-75 text-5xl font-bold tracking-tight tabular-nums duration-300 motion-reduce:animate-none">
        {total}
      </span>
      <span className="text-muted-foreground text-sm">{t("Total score")}</span>
    </div>
  );
}

function getFailureSubtitle(dimensions: DimensionInventory): {
  names: string;
  single: { name: string; value: number } | null;
} {
  const failed = Object.entries(dimensions).filter(([, value]) => value < 0);

  const first = failed[0];

  if (failed.length === 1 && first) {
    const [name, value] = first;
    return { names: "", single: { name, value } };
  }

  return { names: failed.map(([name]) => name).join(", "), single: null };
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
  const { completionFooter, isAuthenticated } = usePlayer();
  const entries = buildDimensionEntries(dimensions, []);

  return (
    <ChallengeScreen>
      <div className="flex flex-col items-center gap-3">
        <VictoryHighlight dimensions={dimensions} />
        <p className="text-lg font-medium tracking-tight">{t("Challenge Complete")}</p>
      </div>

      <DimensionList aria-label={t("Final scores")} entries={entries} variant="success" />

      {isAuthenticated && <ChallengeRewardBadges completionResult={completionResult} isSuccess />}

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
  lessonHref: Route;
  onRestart: () => void;
}) {
  const t = useExtracted();
  const { completionFooter, isAuthenticated } = usePlayer();
  const entries = buildDimensionEntries(dimensions, []);
  const { names, single } = getFailureSubtitle(dimensions);

  const subtitle = single
    ? t("{name} dropped to {value}.", { name: single.name, value: String(single.value) })
    : t("{names} dropped below zero.", { names });

  return (
    <ChallengeScreen>
      <div className="flex w-full flex-col gap-1">
        <p className="text-2xl font-bold tracking-tight">{t("Game over.")}</p>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>

      <DimensionList aria-label={t("Final scores")} entries={entries} variant="failure" />

      {isAuthenticated && (
        <ChallengeRewardBadges completionResult={completionResult} isSuccess={false} />
      )}

      <ChallengeActions>
        <Button className="w-full lg:justify-between" onClick={onRestart} size="lg">
          {t("Try again")}
          <PrimaryKbd>R</PrimaryKbd>
        </Button>

        <SecondaryActionLink href={lessonHref} shortcut="Esc">
          {t("All Activities")}
        </SecondaryActionLink>
      </ChallengeActions>

      {completionFooter}
    </ChallengeScreen>
  );
}
