"use client";

import { fillChallengeNames, getChallengeNames } from "@zoonk/core/library/challenges/team";
import { useCallback, useMemo } from "react";
import { useLessonPlayerConfig } from "../../lesson-player-context";
import { type StepOf } from "../lesson-step-view-props";

type ChallengeSlots = StepOf<"challenge">["content"]["team"];

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
