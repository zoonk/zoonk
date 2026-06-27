"use client";

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
import { MilestoneActions } from "./completion-milestone-actions";
import { UnauthenticatedCompletionPrompt } from "./unauthenticated-progress-prompt";

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
        isInline ? "flex-1" : "w-full",
      )}
      href={chapterHref}
    >
      {t("Exit")}
      {isInline ? <SecondaryKbd>Esc</SecondaryKbd> : <PrimaryKbd>Esc</PrimaryKbd>}
    </PlayerLink>
  );

  const restartButton = (
    <Button
      aria-keyshortcuts="r"
      className={cn(isInline ? "flex-1" : "w-full")}
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
      <CompletionActions>
        <MilestoneActions />
      </CompletionActions>
    );
  }

  return (
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

  return (
    <CompletionActions>
      <UnauthenticatedCompletionPrompt />

      {nextLessonHref && (
        <ActionRow>
          <PlayerLink
            className={cn(buttonVariants({ size: "lg" }), "min-w-0 flex-1")}
            href={loginHref}
          >
            {t("Log in")}
          </PlayerLink>

          <PrimaryActionLink className="min-w-0 flex-1" href={nextLessonHref} shortcut="Enter">
            {t("Next")}
          </PrimaryActionLink>
        </ActionRow>
      )}

      {!nextLessonHref && (
        <PlayerLink className={cn(buttonVariants({ size: "lg" }), "w-full")} href={loginHref}>
          {t("Log in")}
        </PlayerLink>
      )}

      <SecondaryActions chapterHref={chapterHref} onRestart={onRestart} variant="inline" />
    </CompletionActions>
  );
}

export function AuthBranch({
  chapterHref,
  nextLessonHref,
  onRestart,
}: {
  chapterHref: PlayerRoute;
  nextLessonHref: PlayerRoute | null;
  onRestart: () => void;
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
      chapterHref={chapterHref}
      nextLessonHref={nextLessonHref}
      onRestart={onRestart}
    />
  );
}
