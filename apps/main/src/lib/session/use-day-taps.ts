"use client";

import { useRouter } from "@/i18n/navigation";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { type OpenStudyDayInput } from "@zoonk/core/sessions/open-day-contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback } from "react";
import { type TapDay, type TapResult, type TapStep } from "./day-entry";
import { beginDayEntry, endDayEntry, updateDayEntry } from "./day-entry-registry";
import { sendDayOpen, toDestinationResult, toTapResult } from "./day-tap";
import {
  addExtraStudyBlockAction,
  catchUpTodayAction,
  openNextStudyBlockAction,
  openStudyBlockAction,
  prepareTodayLessonsAction,
} from "./study-session-actions";
import {
  SESSION_PATH,
  getCurrentLocation,
  getSessionHref,
  useGoToStudyDestination,
} from "./use-study-navigation";

function isStill({ generation, origin }: { generation: number; origin: string }): boolean {
  return generation === getLearnerGeneration() && origin === getCurrentLocation();
}

function toShownDate(localDate: Date): string {
  return localDate.toISOString().slice(0, 10);
}

function isFocusOnControl(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body;
}

type TapRequest = {
  next: boolean;
  openInput: (fields: Pick<OpenStudyDayInput, "keepEmpty" | "target">) => OpenStudyDayInput;
  sessionId: string | null;
  step: TapStep;
  stillHere: () => boolean;
};

/** A day not opened yet opens with the step's work (`ref`), so no tap names an id the day doesn't have. */
function requestTap({
  next,
  openInput,
  sessionId,
  step,
  stillHere,
}: TapRequest): Promise<TapResult> {
  if (sessionId === null || step.blockId === null) {
    const { ref } = step;

    if (!ref) {
      return Promise.resolve({ kind: "failed" });
    }

    const target = next ? { kind: "next" as const, shown: ref } : { kind: "ref" as const, ref };

    return sendDayOpen({ input: openInput({ target }), stillHere }).then(
      toTapResult,
      (): TapResult => ({ kind: "failed" }),
    );
  }

  const timeZone = getLocalTimeZone();

  const action = next
    ? openNextStudyBlockAction({ expectedBlockId: step.blockId, sessionId, timeZone })
    : openStudyBlockAction({ blockId: step.blockId, sessionId, timeZone });

  return noteAppWrite(action).then(toDestinationResult, (): TapResult => ({ kind: "failed" }));
}

/** Nothing here starts AI work on its own: only a tapped step's start does. */
export function useDayTaps({ day, refresh }: { day: TapDay; refresh: () => void }) {
  const router = useRouter();
  const go = useGoToStudyDestination({ refresh });
  const { sessionId, shown } = day;

  const openInput = useCallback(
    (fields: Pick<OpenStudyDayInput, "keepEmpty" | "target">): OpenStudyDayInput => ({
      ...fields,
      goalId: shown.goalId,
      shownDate: toShownDate(shown.day.localDate),
      timeZone: getLocalTimeZone(),
    }),
    [shown],
  );

  const request = useCallback(
    (tapped: Omit<TapRequest, "openInput" | "sessionId">) =>
      requestTap({ ...tapped, openInput, sessionId }),
    [openInput, sessionId],
  );

  const applyHere = useCallback(
    (result: TapResult): Promise<boolean> | boolean => {
      if (result.kind === "failed") {
        return false;
      }

      if (result.kind === "refresh") {
        refresh();
        return true;
      }

      return go(result.destination);
    },
    [go, refresh],
  );

  const tap = useCallback(
    async ({ next, step }: { next: boolean; step: TapStep }): Promise<boolean> => {
      const generation = getLearnerGeneration();
      const origin = getCurrentLocation();
      const focusMain = isFocusOnControl();

      const href =
        step.screen === "session"
          ? getSessionHref(
              step.blockId
                ? { blockId: step.blockId, limit: null }
                : { goalId: shown.goalId, limit: null },
            )
          : null;

      const stillHere = () =>
        generation === getLearnerGeneration() && [origin, href].includes(getCurrentLocation());

      // Sent before navigating, so the navigation never holds it back.
      const answer = request({ next, step, stillHere });

      if (href) {
        const entry = beginDayEntry({
          day,
          focusMain,
          generation,
          href,
          next,
          step,
          tappedAt: Date.now(),
        });

        // Within the session screen the step replaces the one shown; Back still leads to Today.
        if (href !== origin && (origin === SESSION_PATH || origin.startsWith(`${SESSION_PATH}?`))) {
          router.replace(href);
        } else if (href !== origin) {
          router.push(href);
        }

        void answer.then((result) => updateDayEntry(entry.id, { result }));
        return true;
      }

      const result = await answer;

      if (!isStill({ generation, origin })) {
        return false;
      }

      if (result.kind !== "failed") {
        endDayEntry();
      }

      return applyHere(result);
    },
    [applyHere, day, request, router, shown],
  );

  const openKept = useCallback(
    async (scope: { generation: number; origin: string }): Promise<string | null> => {
      if (sessionId !== null) {
        return sessionId;
      }

      const outcome = await sendDayOpen({
        input: openInput({ keepEmpty: true }),
        stillHere: () => isStill(scope),
      });

      return outcome.status === "opened" && isStill(scope) ? outcome.sessionId : null;
    },
    [openInput, sessionId],
  );

  return {
    addExtraTime: async () => {
      const scope = { generation: getLearnerGeneration(), origin: getCurrentLocation() };
      const opened = await openKept(scope);

      if (!opened) {
        return false;
      }

      const destination = await noteAppWrite(
        addExtraStudyBlockAction({ sessionId: opened, timeZone: getLocalTimeZone() }),
      );

      return isStill(scope) ? applyHere(toDestinationResult(destination)) : false;
    },
    catchUp: async () => {
      const scope = { generation: getLearnerGeneration(), origin: getCurrentLocation() };
      const opened = await openKept(scope);

      if (!opened) {
        return false;
      }

      const added = await noteAppWrite(
        catchUpTodayAction({ sessionId: opened, timeZone: getLocalTimeZone() }),
      );

      if (added && isStill(scope)) {
        refresh();
      }

      return added;
    },
    next: (step: TapStep) => tap({ next: true, step }),
    open: (step: TapStep) => tap({ next: false, step }),
    prepareLessons: async () => {
      const scope = { generation: getLearnerGeneration(), origin: getCurrentLocation() };
      const prepared = await noteAppWrite(prepareTodayLessonsAction({ goalId: day.shown.goalId }));

      if (prepared && isStill(scope)) {
        refresh();
      }

      return prepared;
    },
  };
}
