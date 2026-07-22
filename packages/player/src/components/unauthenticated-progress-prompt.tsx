"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleAlert } from "lucide-react";
import { useExtracted } from "next-intl";
import { type PlayerRoute } from "../player-context";
import { PlayerLink } from "../player-link";
import { PlayerContentFrame } from "./step-layouts";

/**
 * Provides the shared visual shell for signed-out progress prompts. The copy
 * differs between pre-play and completion states, but the layout should stay
 * consistent so the auth warning feels like one product moment.
 */
function ProgressPromptFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center gap-5 text-center",
        className,
      )}
      data-slot="unauthenticated-progress-prompt"
      {...props}
    />
  );
}

/**
 * Renders the warning icon without introducing a new badge or card system.
 * The icon gives the prompt a stronger visual anchor while keeping the screen
 * minimal and consistent with the rest of the player.
 */
function ProgressPromptIcon() {
  return <CircleAlert className="text-foreground size-11" />;
}

/**
 * Holds the headline and explanatory copy for the prompt. Keeping this wrapper
 * shared prevents the start and completion branches from drifting in spacing
 * or typography as the auth copy evolves.
 */
function ProgressPromptCopy({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

/**
 * Renders the prompt title with completion-screen scale rather than page-hero
 * scale. The warning appears inside a lesson flow, so it should be prominent
 * without overpowering the player.
 */
function ProgressPromptTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-2xl font-semibold tracking-tight", className)} {...props}>
      {children}
    </h2>
  );
}

/**
 * Renders supporting copy for signed-out progress prompts. This is intentionally
 * constrained to one paragraph so the choice stays easy to scan before a lesson.
 */
function ProgressPromptDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm leading-6 text-balance", className)}
      {...props}
    />
  );
}

/**
 * Groups the auth and continue actions for the pre-play warning. Login is the
 * primary action because it is the only path that preserves future progress,
 * while continuing is still available for learners who only want to try it.
 */
function StartWarningActions({
  loginHref,
  onContinue,
}: {
  loginHref: PlayerRoute;
  onContinue: () => void;
}) {
  const t = useExtracted();

  return (
    <div className="flex w-full flex-col gap-3">
      <PlayerLink className={cn(buttonVariants(), "w-full")} href={loginHref} prefetch={false}>
        {t("Log in to save progress")}
      </PlayerLink>

      <Button className="w-full" onClick={onContinue} variant="outline">
        {t("Continue without saving")}
      </Button>
    </div>
  );
}

/**
 * Shows the signed-out warning before any lesson step is visible. This makes
 * the saving limitation clear before the learner invests time, and keeps the
 * later completion screen honest about what was not persisted.
 */
export function UnauthenticatedStartWarningScreen({
  loginHref,
  onContinue,
}: {
  loginHref: PlayerRoute;
  onContinue: () => void;
}) {
  const t = useExtracted();

  return (
    <PlayerContentFrame
      aria-live="polite"
      className="my-auto flex flex-col items-center"
      role="status"
    >
      <ProgressPromptFrame>
        <ProgressPromptIcon />

        <ProgressPromptCopy>
          <ProgressPromptTitle>{t("Progress won't be saved")}</ProgressPromptTitle>
          <ProgressPromptDescription>
            {t(
              "You can try this lesson without an account, but your score, course progress, levels, and Energy won't be saved.",
            )}
          </ProgressPromptDescription>
        </ProgressPromptCopy>

        <StartWarningActions loginHref={loginHref} onContinue={onContinue} />
      </ProgressPromptFrame>
    </PlayerContentFrame>
  );
}

/**
 * Shows the honest post-completion signed-out message. The completed attempt
 * was not persisted, so this prompt points learners to log in before their
 * next lesson instead of promising that the current result can still be saved.
 */
export function UnauthenticatedCompletionPrompt() {
  const t = useExtracted();

  return (
    <ProgressPromptFrame className="gap-4">
      <ProgressPromptCopy>
        <ProgressPromptTitle className="text-xl">
          {t("This lesson wasn't saved")}
        </ProgressPromptTitle>
        <ProgressPromptDescription>
          {t("Log in before your next lesson to keep future progress, scores, levels, and Energy.")}
        </ProgressPromptDescription>
      </ProgressPromptCopy>
    </ProgressPromptFrame>
  );
}
