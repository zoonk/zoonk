import { cn } from "@zoonk/ui/lib/utils";
import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";
import { PlayerContentFrame } from "./step-layouts";

type PlayerReadSceneTitleTone = "destructive" | "foreground" | "muted" | "success" | "warning";

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
 * Static lesson copy and vocabulary steps live in the same visual family:
 * read something, then move forward. This component keeps that family on one
 * layout contract.
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
 * This prevents read screens from each inventing their own local spacing
 * rules for the same title/body pattern.
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
      className={cn("flex flex-col gap-1 sm:gap-4", className)}
      data-slot="player-read-scene-stack"
    >
      {children}
    </div>
  );
}

/**
 * Shared read-scene title styling.
 *
 * Static text needs a readable headline treatment. Keeping it here makes
 * title changes fan out once.
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
 * Static explanations should stay visually aligned, so the baseline body
 * typography lives here.
 */
export function PlayerReadSceneBody({ children }: { children: React.ReactNode }) {
  const content = typeof children === "string" ? stripWrappingQuotes(children) : children;

  return (
    <p
      className="text-lg leading-relaxed sm:text-xl sm:leading-relaxed"
      data-slot="player-read-scene-body"
    >
      {content}
    </p>
  );
}
