import { cn } from "@zoonk/ui/lib/utils";

/**
 * Provides one shared style for short, muted helper copy across the player.
 *
 * Investigation notes, completion summaries, and other small supporting lines
 * were repeating the same text classes in multiple components. Centralizing
 * that treatment here reduces drift without forcing unrelated scenes to share
 * larger layout primitives.
 */
export function PlayerSupportingText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="player-supporting-text"
    >
      {children}
    </p>
  );
}
