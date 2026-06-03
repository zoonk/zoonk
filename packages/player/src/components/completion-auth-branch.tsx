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
  chapterHref,
  onRestart,
  variant,
}: {
  chapterHref: PlayerRoute;
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
      href={chapterHref}
    >
      {t("All Lessons")}
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
  chapterHref,
  nextLessonHref,
  onRestart,
  showRewards,
}: {
  chapterHref: PlayerRoute;
  completionResult: CompletionResult | null;
  nextLessonHref: PlayerRoute | null;
  onRestart: () => void;
  showRewards: boolean;
}) {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  if (milestone) {
    return (
      <CompletionActions>
        <MilestoneActions />
      </CompletionActions>
    );
  }

  return (
    <>
      {showRewards && completionResult && (
        <RewardBadges
          brainPower={completionResult.brainPower}
          energyDelta={completionResult.energyDelta}
        />
      )}

      <CompletionActions>
        {nextLessonHref ? (
          <>
            <PrimaryActionLink href={nextLessonHref} shortcut="Enter">
              {t("Next")}
            </PrimaryActionLink>

            <SecondaryActions chapterHref={chapterHref} onRestart={onRestart} variant="inline" />
          </>
        ) : (
          <SecondaryActions chapterHref={chapterHref} onRestart={onRestart} variant="stacked" />
        )}
      </CompletionActions>
    </>
  );
}

function UnauthenticatedContent({
  chapterHref,
  loginHref,
  nextLessonHref,
  onRestart,
}: {
  chapterHref: PlayerRoute;
  loginHref: PlayerRoute;
  nextLessonHref: PlayerRoute | null;
  onRestart: () => void;
}) {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  if (milestone) {
    return <UnauthenticatedMilestoneActions loginHref={loginHref} />;
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("Sign up to track your progress")}</p>

      <CompletionActions>
        <PlayerLink
          className={cn(
            buttonVariants({ variant: nextLessonHref ? "outline" : undefined }),
            "w-full",
          )}
          href={loginHref}
        >
          {t("Log in to save your progress")}
        </PlayerLink>

        {nextLessonHref && (
          <PrimaryActionLink href={nextLessonHref} shortcut="Enter">
            {t("Next")}
          </PrimaryActionLink>
        )}

        <SecondaryActions chapterHref={chapterHref} onRestart={onRestart} variant="inline" />
      </CompletionActions>
    </>
  );
}

export function AuthBranch({
  completionResult,
  chapterHref,
  nextLessonHref,
  onRestart,
  showRewards = true,
}: {
  chapterHref: PlayerRoute;
  completionResult: CompletionResult | null;
  nextLessonHref: PlayerRoute | null;
  onRestart: () => void;
  showRewards?: boolean;
}) {
  const { loginHref } = usePlayerNavigation();
  const { isAuthenticated } = usePlayerViewer();

  if (!isAuthenticated) {
    return (
      <UnauthenticatedContent
        chapterHref={chapterHref}
        loginHref={loginHref ?? "/login"}
        nextLessonHref={nextLessonHref}
        onRestart={onRestart}
      />
    );
  }

  return (
    <AuthenticatedContent
      completionResult={completionResult}
      chapterHref={chapterHref}
      nextLessonHref={nextLessonHref}
      onRestart={onRestart}
      showRewards={showRewards}
    />
  );
}
