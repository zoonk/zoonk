"use client";

import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { openStudyBlockAction } from "@/lib/session/study-session-actions";
import { getCurrentLocation, useGoToStudyDestination } from "@/lib/session/use-study-navigation";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";

type TutorAppLinks = NonNullable<LessonTutorConfig["navigation"]["appLinks"]>;

export function useTutorAppLinks(): TutorAppLinks {
  const go = useGoToStudyDestination();

  return useMemo(
    () => ({
      openBlock: async (blockId) => {
        const openedFrom = getCurrentLocation();

        const destination = await noteAppWrite(
          openStudyBlockAction({
            target: { blockId, kind: "mission" },
            timeZone: getLocalTimeZone(),
          }),
        );

        if (openedFrom !== getCurrentLocation()) {
          return null;
        }

        await go(destination);
        return destination?.kind === "changed" ? "closed" : null;
      },
    }),
    [go],
  );
}
