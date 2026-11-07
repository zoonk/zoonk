"use client";

import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { withGoal } from "@/lib/learn/goal-param";
import { type DayBlockRef } from "@zoonk/core/sessions/day-block";
import { type MissionLinks } from "@zoonk/learn/buddy";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback, useMemo } from "react";
import { openStudyBlockAction, saveMissionDayAction } from "./study-session-actions";
import { answerHere, openingHere } from "./tap-answer";
import { useGoToStudyDestination, useReread } from "./use-study-navigation";

/**
 * Opens one of today's blocks from a link to it. Resolves like `useGoToStudyDestination`, except that
 * `changed`, a block that isn't free to start anymore, is left to the caller.
 */
export function useOpenMissionBlock({
  learner,
  refresh,
}: { learner?: string; refresh?: () => void } = {}) {
  const go = useGoToStudyDestination({ refresh });
  const reread = useReread(refresh);

  return useCallback(
    async (blockId: string): Promise<boolean | "changed"> => {
      const here = openingHere(learner);

      const opened = await answerHere(
        noteAppWrite(
          openStudyBlockAction({
            target: { blockId, kind: "mission" },
            timeZone: getLocalTimeZone(),
          }),
        ),
        here,
      );

      if (typeof opened === "boolean") {
        return opened;
      }

      // Only an answer with nothing to open reads the page again: Next turns a refresh that can't
      // reach the server into a full page load, which offline lands on the browser's error page.
      if (!opened.answer) {
        reread();
        return false;
      }

      return opened.answer.kind === "changed" ? "changed" : go(opened.answer, { here });
    },
    [go, learner, reread],
  );
}

export function useMissionLinks(
  goalId: string,
  {
    carryGoal = false,
    learner,
    openStep,
    refresh,
  }: {
    carryGoal?: boolean;
    learner?: string;
    openStep?: (ref: DayBlockRef) => Promise<boolean>;
    refresh?: () => void;
  } = {},
): MissionLinks {
  const shownGoal = carryGoal ? goalId : undefined;
  const openMissionBlock = useOpenMissionBlock({ learner, refresh });
  const reread = useReread(refresh);

  return useMemo(
    () => ({
      hrefs: {
        areaPractice: (areaId) => `/content/chapters/${areaId}`,
        buddy: "/buddy",
        call: (chapterId) => `/content/units/${chapterId}`,
        mistakesPractice: withGoal("/mistakes/practice", shownGoal),
        mockChooser: withGoal("/mock/new", shownGoal),
        pattern: (patternId) => `/pattern/${patternId}`,
        pronunciation: `/pronunciation?goal=${goalId}`,
      },
      openBlock: async (blockId) => {
        const opened = await openMissionBlock(blockId);

        if (opened !== "changed") {
          return opened;
        }

        reread();
        return true;
      },
      // Fired with the tap, never awaited: the page opens at once (see `saveMissionDayAction`).
      openPage: () => {
        saveMissionDayAction({ goalId, timeZone: getLocalTimeZone() }).catch(() => null);
      },
      openStep,
    }),
    [goalId, openMissionBlock, openStep, reread, shownGoal],
  );
}
