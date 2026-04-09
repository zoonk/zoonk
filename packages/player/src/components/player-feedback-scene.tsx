"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { PlayerContentFrame } from "./step-layouts";

/**
 * Shared shell for dedicated feedback screens.
 *
 * Standard answer feedback, story consequences, and investigation call
 * verdicts all replace the underlying step with a centered status scene.
 * Keeping that shell here prevents those feedback variants from drifting.
 */
export function PlayerFeedbackScene({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PlayerContentFrame
      aria-live="polite"
      className={cn("my-auto flex flex-col gap-6 py-4 sm:py-6", className)}
      data-slot="player-feedback-scene"
      role="status"
    >
      {children}
    </PlayerContentFrame>
  );
}

/**
 * Shared feedback copy styling so all dedicated feedback scenes speak with the
 * same visual voice even when their inner content differs.
 */
export function PlayerFeedbackSceneMessage({
  children,
  ...props
}: Omit<React.ComponentProps<"p">, "className">) {
  return (
    <p
      className="text-foreground text-lg leading-relaxed"
      data-slot="player-feedback-scene-message"
      {...props}
    >
      {children}
    </p>
  );
}
