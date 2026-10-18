"use client";

import { useRouter } from "@/i18n/navigation";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { noteLearnerWrite } from "@/lib/learner/learner-views";
import { type OpenStudyDayInput } from "@zoonk/core/sessions/open-day-contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback } from "react";
import { type TapDay, type TapResult, type TapStep } from "./day-entry";
import { beginDayEntry, endDayEntry, updateDayEntry } from "./day-entry-registry";
import { sendDayOpen, toDestinationResult, toTapResult } from "./day-tap";
import { type StudyDestination } from "./study-destination";
import {
  addExtraStudyBlockAction,
  catchUpTodayAction,
  openNextStudyBlockAction,
  openStudyBlockAction,
} from "./study-session-actions";
import {
  SESSION_PATH,
  getCurrentLocation,
  getSessionHref,
  useGoToStudyDestination,
} from "./use-study-navigation";

/** Whether the tab is still where `origin` was, for the identity it held then (`generation`). */
function isStill({ generation, origin }: { generation: number; origin: string }): boolean {
  return generation === getLearnerGeneration() && origin === getCurrentLocation();
}

/** The learner-local day a screen showed, as the open names it (`YYYY-MM-DD`). */
function toShownDate(localDate: Date): string {
  return localDate.toISOString().slice(0, 10);
}

/** Whether the tap was made from a control with focus, so the next screen's main action takes it. */
function isFocusOnControl(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body;
}

/** A saved day's action resolved: the tab doesn't know the revision it left, so views read again. */
function noteSavedDayWrite({
  destination,
  generation,
}: {
  destination: StudyDestination | null;
  generation: number;
}): TapResult {
  noteLearnerWrite({ generation });
  return toDestinationResult(destination);
}

type TapRequest = {
  generation: number;
  next: boolean;
  openInput: (fields: Pick<OpenStudyDayInput, "keepEmpty" | "target">) => OpenStudyDayInput;
  sessionId: string | null;
  step: TapStep;
  stillHere: () => boolean;
};

/**
 * Sends a tap's POST: a day not opened yet opens with the work the step is (`ref`), so no tap ever
 * names an id the day doesn't have; a saved day's step opens by its id.
 */
function requestTap({
  generation,
  next,
  openInput,
  sessionId,
  step,
  stillHere,
}: TapRequest): Promise<TapResult> {
  if (sessionId === null || step.blockId === null) {
    const { ref } = step;

    // A step of a day not opened yet is named by its work; one with neither can't be tapped.
    if (!ref) {
      return Promise.resolve({ kind: "failed" });
    }

    const target = next ? { kind: "next" as const, shown: ref } : { kind: "ref" as const, ref };

    return sendDayOpen({ input: openInput({ target }), stillHere }).then(toTapResult, () => {
      // No answer (a lost connection): the open may have saved the day anyway.
      noteLearnerWrite({ generation });
      return { kind: "failed" } satisfies TapResult;
    });
  }

  const timeZone = getLocalTimeZone();

  const action = next
    ? openNextStudyBlockAction({ expectedBlockId: step.blockId, sessionId, timeZone })
    : openStudyBlockAction({ blockId: step.blockId, sessionId, timeZone });

  return action.then(
    (destination) => noteSavedDayWrite({ destination, generation }),
    (): TapResult => ({ kind: "failed" }),
  );
}

/**
 * The learner's taps on a day a screen shows (Today's Start, its rows and mission chips, the
 * session's next step): the request leaves in the tap, and a step that plays on the session screen
 * opens there at once, drawn from what this screen held (its title, the day's segments, its busy
 * Start, and the focus of the control tapped) while the request is answered; the session screen
 * applies the answer. Any other step waits for its answer here, busy, then opens where it plays. A
 * day not opened yet is opened by the tap that names its step (`ref`), so no tap ever names an id
 * the day doesn't have. Nothing here starts AI work on its own: only a tapped step's start does.
 */
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

  /** Applies an answer on the screen that tapped, when it's still there for the same learner. */
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

      // A step that plays on the session screen is drawn there at once, from this tap: at its own
      // address (from Today, or from the session screen showing another step, such as a ready block
      // to do while a lesson is written), or in place when the screen already shows it. Its entry
      // keeps it busy until the screen's content applies the answer, however long that takes.
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
      const answer = request({ generation, next, step, stillHere });

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

      // A tap that went through ends an earlier one the screen still drew (a retry after a failure).
      if (result.kind !== "failed") {
        endDayEntry();
      }

      return applyHere(result);
    },
    [applyHere, day, request, router, shown],
  );

  /**
   * Opens the day with nothing tapped in it yet, for what adds its own block next (catching up,
   * more practice): the saved session's id, or null when it didn't open or the learner moved on
   * meanwhile (`scope`: where and for whom it was asked).
   */
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
    /**
     * "Practice for N minutes": opens the day if needed, adds the block and opens it, while the
     * learner is still where they asked for it.
     */
    addExtraTime: async () => {
      const scope = { generation: getLearnerGeneration(), origin: getCurrentLocation() };
      const opened = await openKept(scope);

      if (!opened) {
        return false;
      }

      const destination = await addExtraStudyBlockAction({
        sessionId: opened,
        timeZone: getLocalTimeZone(),
      });

      const result = noteSavedDayWrite({ destination, generation: scope.generation });
      return isStill(scope) ? applyHere(result) : false;
    },
    /**
     * "Catch up today": opens the day if needed, then its earlier lessons join it, while the
     * learner is still where they asked for it.
     */
    catchUp: async () => {
      const scope = { generation: getLearnerGeneration(), origin: getCurrentLocation() };
      const opened = await openKept(scope);

      if (!opened) {
        return false;
      }

      const added = await catchUpTodayAction({ sessionId: opened, timeZone: getLocalTimeZone() });
      noteLearnerWrite({ generation: scope.generation });

      if (added && isStill(scope)) {
        refresh();
      }

      return added;
    },
    /** Start or Continue: the day's next step, as the screen showed it. */
    next: (step: TapStep) => tap({ next: true, step }),
    /** A row or a mission chip: that step, whichever place it has in the day. */
    open: (step: TapStep) => tap({ next: false, step }),
  };
}
