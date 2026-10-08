"use client";

import { fillChallengeNames, getChallengeNames } from "@zoonk/core/library/challenges/team";
import { useCallback, useMemo } from "react";
import { useLessonPlayerConfig } from "../../lesson-player-context";
import { type StepOf } from "../lesson-step-view-props";

type ChallengeSlots = StepOf<"challenge">["content"]["team"];

/**
 * Each role slot's name from the learner's team (the AI assistant by its role), and a way to put
 * those names into the case's text wherever it says `{{slotId}}`.
 */
export function useChallengeNames(slots: ChallengeSlots) {
  const { challengeTeam } = useLessonPlayerConfig();

  const names = useMemo(
    () => getChallengeNames({ slots, team: challengeTeam }),
    [challengeTeam, slots],
  );

  const fill = useCallback((text: string) => fillChallengeNames(text, names), [names]);

  return { fill, names };
}

export type ChallengeNames = ReturnType<typeof useChallengeNames>;
