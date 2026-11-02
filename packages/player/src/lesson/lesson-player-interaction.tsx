"use client";

import { createContext, use, useMemo, useState } from "react";
import { PlayerInteractionContext } from "../player-context";
import { useTutorBuddy } from "../questions/tutor-buddy";

type LessonInteraction = { isPaused: boolean; setPaused: (isPaused: boolean) => void };

const LessonInteractionContext = createContext<LessonInteraction | null>(null);

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
