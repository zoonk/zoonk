"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type PlayerRoute, usePlayerMilestone } from "../player-context";
import { PlayerLink } from "../player-link";
import {
  PrimaryActionLink,
  PrimaryKbd,
  SecondaryActionButton,
  SecondaryKbd,
} from "./completion-action-link";
import { MilestoneActions } from "./completion-milestone-actions";
import { CompletionPrimaryActionGroup } from "./lesson-question-actions";

/**
 * Keeps every completion action group on the same full-width vertical rhythm.
 * Lesson and curriculum completion have different destinations, but the player
 * should not shift its action layout based on which path reached this screen.
 */
function CompletionActionsLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full flex-col gap-3", className)}
      data-slot="completion-actions"
      {...props}
    />
  );
}

/**
 * Renders the exit and restart fallbacks with the hierarchy required by the
 * available primary action. When there is a next lesson they can share a quiet
 * secondary row; without one, Exit becomes the full-width primary destination.
 */
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
        isInline ? "flex-1" : "w-full",
      )}
      href={chapterHref}
    >
      {t("Exit")}
      {isInline ? <SecondaryKbd>Esc</SecondaryKbd> : <PrimaryKbd>Esc</PrimaryKbd>}
    </PlayerLink>
  );

  const restartButton = (
    <SecondaryActionButton
      className={isInline ? "flex-1" : undefined}
      onClick={onRestart}
      shortcut="R"
    >
      {t("Try again")}
    </SecondaryActionButton>
  );

  if (isInline) {
    return (
      <div className="flex w-full gap-3">
        {backLink}
        {restartButton}
      </div>
    );
  }

  return (
    <>
      <CompletionPrimaryActionGroup>{backLink}</CompletionPrimaryActionGroup>
      {restartButton}
    </>
  );
}

/**
 * Selects completion actions from lesson navigation and curriculum milestones.
 * Authentication is intentionally absent: every learner who reaches completion
 * receives the same destinations and interaction hierarchy.
 */
export function CompletionActions({
  chapterHref,
  nextLessonHref,
  onRestart,
}: {
  chapterHref: PlayerRoute;
  nextLessonHref: PlayerRoute | null;
  onRestart: () => void;
}) {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  if (milestone) {
    return (
      <CompletionActionsLayout>
        <MilestoneActions onRestart={onRestart} />
      </CompletionActionsLayout>
    );
  }

  return (
    <CompletionActionsLayout>
      {nextLessonHref ? (
        <>
          <CompletionPrimaryActionGroup>
            <PrimaryActionLink href={nextLessonHref} shortcut="Enter">
              {t("Next")}
            </PrimaryActionLink>
          </CompletionPrimaryActionGroup>

          <SecondaryActions chapterHref={chapterHref} onRestart={onRestart} variant="inline" />
        </>
      ) : (
        <SecondaryActions chapterHref={chapterHref} onRestart={onRestart} variant="stacked" />
      )}
    </CompletionActionsLayout>
  );
}
