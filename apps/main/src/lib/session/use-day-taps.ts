"use client";

import { useRouter } from "@/i18n/navigation";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { type OpenStudyDayInput } from "@zoonk/core/sessions/open-day-contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback } from "react";
import { type TapDay, type TapResult, type TapStep, hasLeftEntry } from "./day-entry";
import { beginDayEntry, endDayEntry, getDayEntry, updateDayEntry } from "./day-entry-registry";
import { sendDayOpen, toDestinationResult, toTapResult } from "./day-tap";
import {
  addExtraStudyBlockAction,
  catchUpTodayAction,
  openStudyBlockAction,
  prepareTodayLessonsAction,
} from "./study-session-actions";
import { answerHere } from "./tap-answer";
import {
  SESSION_PATH,
  getCurrentLocation,
  getSessionHref,
  stayingHere,
  useGoToStudyDestination,
} from "./use-study-navigation";

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

  const action = openStudyBlockAction({
    target: next
      ? { expectedBlockId: step.blockId, kind: "next", sessionId }
      : { blockId: step.blockId, kind: "block" },
    timeZone: getLocalTimeZone(),
  });

  return noteAppWrite(action).then(toDestinationResult, (): TapResult => ({ kind: "failed" }));
}

/** A failure that lands after the learner left the step's screen ends its entry: they never see it when they come back. */
function settleEntry({ id, origin, result }: { id: number; origin: string; result: TapResult }) {
  const entry = getDayEntry();

  const left =
    entry?.id === id &&
    hasLeftEntry({ at: getCurrentLocation(), entry, generation: getLearnerGeneration(), origin });

  if (result.kind === "failed" && left) {
    endDayEntry(id);
  } else {
    updateDayEntry(id, { result });
  }
}

/**
 * Nothing here starts AI work on its own: only a tapped step's start does. A tap that stops because
 * the learner left resolves true: the screen they left has nothing to report, even when they return.
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
      const here = stayingHere();
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

        void answer.then((result) => settleEntry({ id: entry.id, origin, result }));

        return true;
      }

      const result = await answer;

      if (!here()) {
        return true;
      }

      if (result.kind !== "failed") {
        endDayEntry();
      }

      return applyHere(result);
    },
    [applyHere, day, request, router, shown],
  );

  const openKept = useCallback(
    async (here: () => boolean): Promise<{ answer: string } | boolean> => {
      if (sessionId !== null) {
        return { answer: sessionId };
      }

      const opened = await answerHere(
        sendDayOpen({ input: openInput({ keepEmpty: true }), stillHere: here }),
        here,
      );

      if (typeof opened === "boolean") {
        return opened;
      }

      return opened.answer.status === "opened" ? { answer: opened.answer.sessionId } : false;
    },
    [openInput, sessionId],
  );

  return {
    addExtraTime: async () => {
      const here = stayingHere();
      const kept = await openKept(here);

      if (typeof kept === "boolean") {
        return kept;
      }

      const added = await answerHere(
        noteAppWrite(
          addExtraStudyBlockAction({ sessionId: kept.answer, timeZone: getLocalTimeZone() }),
        ),
        here,
      );

      return typeof added === "boolean" ? added : applyHere(toDestinationResult(added.answer));
    },
    catchUp: async () => {
      const here = stayingHere();
      const kept = await openKept(here);

      if (typeof kept === "boolean") {
        return kept;
      }

      const added = await answerHere(
        noteAppWrite(catchUpTodayAction({ sessionId: kept.answer, timeZone: getLocalTimeZone() })),
        here,
      );

      if (typeof added === "boolean") {
        return added;
      }

      if (added.answer) {
        refresh();
      }

      return added.answer;
    },
    next: (step: TapStep) => tap({ next: true, step }),
    open: (step: TapStep) => tap({ next: false, step }),
    prepareLessons: async () => {
      const here = stayingHere();

      const prepared = await answerHere(
        noteAppWrite(prepareTodayLessonsAction({ goalId: day.shown.goalId })),
        here,
      );

      if (typeof prepared === "boolean") {
        return prepared;
      }

      if (prepared.answer) {
        refresh();
      }

      return prepared.answer;
    },
  };
}
