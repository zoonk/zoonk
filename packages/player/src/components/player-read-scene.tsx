import { cn } from "@zoonk/ui/lib/utils";
import { SectionLabel } from "./section-label";
import { PlayerContentFrame } from "./step-layouts";

/**
 * Shared read-only scene shell for centered player content.
 *
 * Static lesson copy, story intro/outcome, investigation setup, and
 * vocabulary all live in the same visual family: read something, then move
 * forward. This component keeps that family on one layout contract.
 */
export function PlayerReadScene({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PlayerContentFrame
      className={cn(
        "relative my-auto flex flex-col items-start justify-center gap-3 py-4 sm:gap-6 sm:py-6",
        className,
      )}
      data-slot="player-read-scene"
    >
      {children}
    </PlayerContentFrame>
  );
}

/**
 * Groups related read-scene content into a consistent vertical stack.
 *
 * This prevents static and story screens from each inventing their own local
 * spacing rules for the same title/body pattern.
 */
export function PlayerReadSceneStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-3 sm:gap-4", className)}
      data-slot="player-read-scene-stack"
    >
      {children}
    </div>
  );
}

/**
 * Reuses the small uppercase label style for read scenes that need an eyebrow
 * before the main body copy.
 */
export function PlayerReadSceneEyebrow({ children }: { children: React.ReactNode }) {
  return <SectionLabel>{children}</SectionLabel>;
}

/**
 * Shared read-scene title styling.
 *
 * Static text, investigation setup, and story outcomes all need a readable
 * headline treatment. Keeping it here makes title changes fan out once.
 */
export function PlayerReadSceneTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-muted-foreground text-lg font-semibold tracking-tight sm:text-xl",
        className,
      )}
      data-slot="player-read-scene-title"
    >
      {children}
    </h2>
  );
}

/**
 * Shared body copy styling for read scenes.
 *
 * Story narrative, static explanations, and investigation setup copy should
 * stay visually aligned, so the baseline body typography lives here.
 */
export function PlayerReadSceneBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn("text-lg leading-relaxed sm:text-xl sm:leading-relaxed", className)}
      data-slot="player-read-scene-body"
    >
      {children}
    </p>
  );
}

/**
 * Standard divider used by read scenes to separate narrative copy from
 * secondary metadata such as metrics.
 */
export function PlayerReadSceneDivider({ className }: { className?: string }) {
  return (
    <div className={cn("bg-border h-px w-full", className)} data-slot="player-read-scene-divider" />
  );
}
