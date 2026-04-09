/**
 * Provides one shared style for short, muted helper copy across the player.
 *
 * Investigation notes, completion summaries, and other small supporting lines
 * were repeating the same text classes in multiple components. Centralizing
 * that treatment here reduces drift without forcing unrelated scenes to share
 * larger layout primitives.
 */
export function PlayerSupportingText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-sm" data-slot="player-supporting-text">
      {children}
    </p>
  );
}
