"use client";

import { useMissionLinks } from "@/lib/session/use-study-navigation";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";
import { useMemo } from "react";

type TutorAppLinks = NonNullable<LessonTutorConfig["navigation"]["appLinks"]>;

/**
 * How the buddy's answers inside a goal link the app: a block of today's session opens as Today
 * opens it (`useMissionLinks().openBlock`), and every other link through main's `Link`.
 */
export function useTutorAppLinks(goalId: string): TutorAppLinks {
  const { openBlock } = useMissionLinks(goalId);

  return useMemo(
    () => ({
      openBlock: (blockId) => {
        void openBlock(blockId);
      },
    }),
    [openBlock],
  );
}
