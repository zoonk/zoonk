"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type Route } from "next";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { type CompletionResult } from "../completion-input-schema";
import { usePlayer } from "../player-context";
import { BeltProgressHint, BeltProgressSkeleton } from "./belt-progress";
import { PrimaryActionLink, PrimaryKbd, SecondaryKbd } from "./completion-action-link";
import { MilestoneActions, UnauthenticatedMilestoneActions } from "./completion-milestone-actions";
import { RewardBadges, RewardBadgesSkeleton } from "./reward-badges";

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
  lessonHref: Route;
  onRestart: () => void;
  variant: "inline" | "stacked";
}) {
  const t = useExtracted();

  const isInline = variant === "inline";

  const backLink = (
    <Link
      className={cn(
        buttonVariants({ variant: isInline ? "outline" : "default" }),
        isInline ? "flex-1 lg:justify-between" : "w-full lg:justify-between",
      )}
      href={lessonHref}
    >
      {t("All Activities")}
      {isInline ? <SecondaryKbd>Esc</SecondaryKbd> : <PrimaryKbd>Esc</PrimaryKbd>}
    </Link>
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
  lessonHref: Route;
  nextActivityHref: Route | null;
  onRestart: () => void;
  showRewards: boolean;
}) {
  const t = useExtracted();
  const { isLastInLesson } = usePlayer();

  const isLoading = !completionResult || completionResult.status !== "success";

  if (isLastInLesson) {
    return (
      <CompletionActions>
        <MilestoneActions lessonHref={lessonHref} />
      </CompletionActions>
    );
  }

  return (
    <>
      {showRewards &&
        (isLoading ? (
          <>
            <RewardBadgesSkeleton />
            <BeltProgressSkeleton />
          </>
        ) : (
          <>
            <RewardBadges
              brainPower={completionResult.brainPower}
              energyDelta={completionResult.energyDelta}
              isChallenge={false}
            />
            <BeltProgressHint
              brainPower={completionResult.brainPower}
              newTotalBp={completionResult.newTotalBp}
            />
          </>
        ))}

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
  onRestart,
}: {
  lessonHref: Route;
  loginHref: Route;
  onRestart: () => void;
}) {
  const t = useExtracted();
  const { isLastInLesson } = usePlayer();

  if (isLastInLesson) {
    return <UnauthenticatedMilestoneActions lessonHref={lessonHref} loginHref={loginHref} />;
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("Sign up to track your progress")}</p>

      <CompletionActions>
        <Link className={cn(buttonVariants(), "w-full")} href={loginHref}>
          {t("Login")}
        </Link>

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
  lessonHref: Route;
  nextActivityHref: Route | null;
  onRestart: () => void;
  showRewards?: boolean;
}) {
  const { isAuthenticated, loginHref } = usePlayer();

  if (!isAuthenticated) {
    return (
      <UnauthenticatedContent
        lessonHref={lessonHref}
        loginHref={loginHref ?? "/login"}
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
