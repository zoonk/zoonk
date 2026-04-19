"use client";

import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  type PlayerRoute,
  usePlayerMilestone,
  usePlayerNavigation,
  usePlayerViewer,
} from "../player-context";
import { PlayerLink } from "../player-link";
import { BeltProgressHint } from "./belt-progress";
import { PrimaryActionLink, PrimaryKbd, SecondaryKbd } from "./completion-action-link";
import { MilestoneActions, UnauthenticatedMilestoneActions } from "./completion-milestone-actions";
import { RewardBadges } from "./reward-badges";

function CompletionActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full flex-col gap-3", className)}
      data-slot="completion-actions"
      {...props}
    />
  );
}

function ActionRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex w-full gap-3", className)} {...props} />;
}

function SecondaryActions({
  lessonHref,
  onRestart,
  variant,
}: {
  lessonHref: PlayerRoute;
  onRestart: () => void;
  variant: "inline" | "stacked";
}) {
  const t = useExtracted();

  const isInline = variant === "inline";

  const backLink = (
    <PlayerLink
      className={cn(
        buttonVariants({ variant: isInline ? "outline" : "default" }),
        isInline ? "flex-1 lg:justify-between" : "w-full lg:justify-between",
      )}
      href={lessonHref}
    >
      {t("All Activities")}
      {isInline ? <SecondaryKbd>Esc</SecondaryKbd> : <PrimaryKbd>Esc</PrimaryKbd>}
    </PlayerLink>
  );

  const restartButton = (
    <Button
      className={cn(isInline ? "flex-1" : "w-full", "lg:justify-between")}
      onClick={onRestart}
      variant="outline"
    >
      {t("Try again")}
      <SecondaryKbd>R</SecondaryKbd>
    </Button>
  );

  if (isInline) {
    return (
      <ActionRow>
        {backLink}
        {restartButton}
      </ActionRow>
    );
  }

  return (
    <>
      {backLink}
      {restartButton}
    </>
  );
}

function AuthenticatedContent({
  completionResult,
  lessonHref,
  nextActivityHref,
  onRestart,
  showRewards,
}: {
  completionResult: CompletionResult | null;
  lessonHref: PlayerRoute;
  nextActivityHref: PlayerRoute | null;
  onRestart: () => void;
  showRewards: boolean;
}) {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  if (milestone.kind !== "activity") {
    return (
      <CompletionActions>
        <MilestoneActions />
      </CompletionActions>
    );
  }

  return (
    <>
      {showRewards && completionResult && (
        <>
          <RewardBadges
            brainPower={completionResult.brainPower}
            energyDelta={completionResult.energyDelta}
          />
          <BeltProgressHint
            brainPower={completionResult.brainPower}
            newTotalBp={completionResult.newTotalBp}
          />
        </>
      )}

      <CompletionActions>
        {nextActivityHref ? (
          <>
            <PrimaryActionLink href={nextActivityHref} shortcut="Enter">
              {t("Next")}
            </PrimaryActionLink>

            <SecondaryActions lessonHref={lessonHref} onRestart={onRestart} variant="inline" />
          </>
        ) : (
          <SecondaryActions lessonHref={lessonHref} onRestart={onRestart} variant="stacked" />
        )}
      </CompletionActions>
    </>
  );
}

function UnauthenticatedContent({
  lessonHref,
  loginHref,
  nextActivityHref,
  onRestart,
}: {
  lessonHref: PlayerRoute;
  loginHref: PlayerRoute;
  nextActivityHref: PlayerRoute | null;
  onRestart: () => void;
}) {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  if (milestone.kind !== "activity") {
    return <UnauthenticatedMilestoneActions loginHref={loginHref} />;
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("Sign up to track your progress")}</p>

      <CompletionActions>
        <PlayerLink
          className={cn(
            buttonVariants({ variant: nextActivityHref ? "outline" : undefined }),
            "w-full",
          )}
          href={loginHref}
        >
          {t("Login")}
        </PlayerLink>

        {nextActivityHref && (
          <PrimaryActionLink href={nextActivityHref} shortcut="Enter">
            {t("Next")}
          </PrimaryActionLink>
        )}

        <SecondaryActions lessonHref={lessonHref} onRestart={onRestart} variant="inline" />
      </CompletionActions>
    </>
  );
}

export function AuthBranch({
  completionResult,
  lessonHref,
  nextActivityHref,
  onRestart,
  showRewards = true,
}: {
  completionResult: CompletionResult | null;
  lessonHref: PlayerRoute;
  nextActivityHref: PlayerRoute | null;
  onRestart: () => void;
  showRewards?: boolean;
}) {
  const { loginHref } = usePlayerNavigation();
  const { isAuthenticated } = usePlayerViewer();

  if (!isAuthenticated) {
    return (
      <UnauthenticatedContent
        lessonHref={lessonHref}
        loginHref={loginHref ?? "/login"}
        nextActivityHref={nextActivityHref}
        onRestart={onRestart}
      />
    );
  }

  return (
    <AuthenticatedContent
      completionResult={completionResult}
      lessonHref={lessonHref}
      nextActivityHref={nextActivityHref}
      onRestart={onRestart}
      showRewards={showRewards}
    />
  );
}
