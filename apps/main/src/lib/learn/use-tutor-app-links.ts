"use client";

import { useOpenMissionBlock } from "@/lib/session/use-mission-links";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";

type TutorAppLinks = NonNullable<LessonTutorConfig["navigation"]["appLinks"]>;

export function useTutorAppLinks(): TutorAppLinks {
  const openBlock = useOpenMissionBlock();
  return { openBlock };
}
