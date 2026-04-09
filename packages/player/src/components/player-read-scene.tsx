import { cn } from "@zoonk/ui/lib/utils";
import { SectionLabel } from "./section-label";
import { PlayerContentFrame } from "./step-layouts";

export type PlayerReadSceneTitleTone =
  | "destructive"
  | "foreground"
  | "muted"
  | "success"
  | "warning";

const PLAYER_READ_SCENE_TITLE_TONE_CLASS: Record<PlayerReadSceneTitleTone, string> = {
  destructive: "text-destructive",
  foreground: "text-foreground",
  muted: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
};

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
 * Gives read scenes one shared visual treatment for small section labels.
 *
 * Story intro and outcome both show a short uppercase label above metrics.
 * Keeping that copy style here prevents those static/read screens from
 * quietly drifting apart when spacing or typography changes later.
 */
export function PlayerReadSceneMetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-muted-foreground text-xs font-medium tracking-widest uppercase"
      data-slot="player-read-scene-meta-label"
    >
      {children}
    </p>
  );
}

/**
 * Shared read-scene title styling.
 *
 * Static text, investigation setup, and story outcomes all need a readable
 * headline treatment. Keeping it here makes title changes fan out once.
 */
export function PlayerReadSceneTitle({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: PlayerReadSceneTitleTone;
}) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold tracking-tight sm:text-xl",
        PLAYER_READ_SCENE_TITLE_TONE_CLASS[tone],
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
export function PlayerReadSceneBody({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-lg leading-relaxed sm:text-xl sm:leading-relaxed"
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
