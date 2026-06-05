"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PrimaryKbd } from "./completion-action-link";
import { PlayerContentFrame } from "./step-layouts";

/**
 * Milestone screens use the same content frame as completion so the extra
 * screen feels like part of the player flow rather than a modal interruption.
 */
export function CompletionMilestoneScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <PlayerContentFrame
      aria-live="polite"
      className={cn(
        "my-auto flex min-h-[60vh] flex-col items-center justify-center gap-8",
        className,
      )}
      data-slot="completion-milestone-screen"
      role="status"
      {...props}
    />
  );
}

/**
 * The visual mark gives the milestone a quiet focal point without adding a
 * celebratory illustration or a large progress widget to the completion flow.
 */
export function CompletionMilestoneMark({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-center gap-4", className)}
      data-slot="completion-milestone-mark"
      {...props}
    >
      <span aria-hidden="true" className="bg-border h-px w-16" />
      {children}
      <span aria-hidden="true" className="bg-border h-px w-16" />
    </div>
  );
}

/**
 * Copy is grouped separately from the mark so future milestone kinds can reuse
 * the same screen shell with different wording and visual affordances.
 */
export function CompletionMilestoneCopy({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex max-w-md flex-col items-center gap-3 text-center", className)}
      data-slot="completion-milestone-copy"
      {...props}
    />
  );
}

/**
 * The heading stays compact because this screen appears inside a lesson flow,
 * not on a standalone landing page.
 */
export function CompletionMilestoneTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-3xl font-semibold tracking-tight sm:text-4xl", className)}
      data-slot="completion-milestone-title"
      {...props}
    >
      {children}
    </h2>
  );
}

/**
 * Milestone actions need one obvious way back into the lesson-completion flow
 * plus an optional learning link for the relevant progress system.
 */
export function CompletionMilestoneActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full max-w-sm flex-col gap-3", className)}
      data-slot="completion-milestone-actions"
      {...props}
    />
  );
}

/**
 * The primary button is shared so every milestone advances through the same
 * visible and keyboard-confirmed Continue affordance.
 */
export function CompletionMilestoneContinueButton({
  children,
  onContinue,
}: {
  children: React.ReactNode;
  onContinue: () => void;
}) {
  return (
    <Button className="w-full lg:justify-between" onClick={onContinue} size="lg">
      {children}
      <PrimaryKbd>Enter</PrimaryKbd>
    </Button>
  );
}
