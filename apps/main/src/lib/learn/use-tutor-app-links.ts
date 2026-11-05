"use client";

import { useMissionLinks } from "@/lib/session/use-study-navigation";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";

type TutorAppLinks = NonNullable<LessonTutorConfig["navigation"]["appLinks"]>;

export function useTutorAppLinks(goalId: string): TutorAppLinks {
  const { openBlock } = useMissionLinks(goalId);
  return { openBlock };
}
