import { cn } from "@zoonk/ui/lib/utils";
import { PlayerRichText } from "./player-rich-text";
import { PlayerContentFrame } from "./step-layouts";

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
 * Shared body copy styling for read scenes.
 *
 * Static explanations should stay visually aligned, so the baseline body
 * typography lives here.
 */
export function PlayerReadSceneBody({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-lg leading-relaxed sm:text-xl sm:leading-relaxed"
      data-slot="player-read-scene-body"
    >
      {typeof children === "string" ? <PlayerRichText text={children} /> : children}
    </p>
  );
}
