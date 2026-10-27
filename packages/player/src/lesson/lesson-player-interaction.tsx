"use client";

import { createContext, use, useMemo, useState } from "react";
import { PlayerInteractionContext } from "../player-context";
import { useTutorBuddy } from "../questions/tutor-buddy";

type LessonInteraction = { isPaused: boolean; setPaused: (isPaused: boolean) => void };

const LessonInteractionContext = createContext<LessonInteraction | null>(null);

/**
 * While a sheet is open over the lesson (the summary, the tutor's drawer), the lesson's keys pause
 * so Enter or a number can't answer the screen underneath. The shared option lists read the same
 * pause through the player's interaction context.
 */
export function LessonInteractionProvider({ children }: { children: React.ReactNode }) {
  const buddy = useTutorBuddy();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const isPaused = isSheetOpen || Boolean(buddy?.drawerOpen);

  const interaction = useMemo(() => ({ isPaused, setPaused: setIsSheetOpen }), [isPaused]);

  return (
    <LessonInteractionContext value={interaction}>
      <PlayerInteractionContext value={isPaused ? "paused" : "active"}>
        {children}
      </PlayerInteractionContext>
    </LessonInteractionContext>
  );
}

export function useLessonInteraction(): LessonInteraction {
  const interaction = use(LessonInteractionContext);

  if (!interaction) {
    throw new Error("useLessonInteraction must be used within a LessonInteractionProvider");
  }

  return interaction;
}
