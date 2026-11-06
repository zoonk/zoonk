"use client";

import { useRouter } from "@/i18n/navigation";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { learnerStaying } from "@/lib/learner/learner-store";
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
import { answerHere, openingHere, stayingHere } from "./tap-answer";
import {
  SESSION_PATH,
  getCurrentLocation,
  getSessionHref,
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
  stillHere: () => Promise<boolean>;
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

/**
 * An answer for a learner who's gone, or a failure that lands after the learner left the step's
 * screen, ends its entry: they never see it when they come back.
 */
async function settleEntry({
  id,
  learnerHere,
  origin,
  result,
}: {
  id: number;
  learnerHere: () => Promise<boolean>;
  origin: string;
  result: TapResult;
}) {
  const stayed = await learnerHere();
  const entry = getDayEntry();

  const left =
    result.kind === "failed" &&
    entry?.id === id &&
    hasLeftEntry({ at: getCurrentLocation(), entry, origin });

  if (!stayed || left) {
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
    (result: TapResult, here: () => Promise<boolean>): Promise<boolean> | boolean => {
      if (result.kind === "failed") {
        return false;
      }

      if (result.kind === "refresh") {
        refresh();
        return true;
      }

      return go(result.destination, { here });
    },
    [go, refresh],
  );

  const tap = useCallback(
    async ({ next, step }: { next: boolean; step: TapStep }): Promise<boolean> => {
      const learnerHere = learnerStaying(shown.userId);
      const origin = getCurrentLocation();
      const here = openingHere(shown.userId);
      const focusMain = isFocusOnControl();

      const href =
        step.screen === "session"
          ? getSessionHref(
              step.blockId
                ? { blockId: step.blockId, limit: null }
                : { goalId: shown.goalId, limit: null },
            )
          : null;

      const stillHere = async () =>
        (await learnerHere()) && [origin, href].includes(getCurrentLocation());

      // Sent before navigating, so the navigation never holds it back.
      const answer = request({ next, step, stillHere });

      if (href) {
        // Within the session screen the step replaces the one shown; Back still leads to Today.
        if (href !== origin && (origin === SESSION_PATH || origin.startsWith(`${SESSION_PATH}?`))) {
          router.replace(href);
        } else if (href !== origin) {
          router.push(href);
        }

        const entry = beginDayEntry({
          day,
          focusMain,
          here: stayingHere(shown.userId),
          href,
          next,
          step,
          tappedAt: Date.now(),
        });

        void answer.then((result) => settleEntry({ id: entry.id, learnerHere, origin, result }));

        return true;
      }

      const answered = await answerHere(answer, here);

      if (typeof answered === "boolean") {
        return answered;
      }

      if (answered.answer.kind !== "failed") {
        endDayEntry();
      }

      return applyHere(answered.answer, here);
    },
    [applyHere, day, request, router, shown],
  );

  const openKept = useCallback(
    async (here: () => Promise<boolean>): Promise<{ answer: string } | boolean> => {
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
      const here = openingHere(shown.userId);
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

      return typeof added === "boolean"
        ? added
        : applyHere(toDestinationResult(added.answer), here);
    },
    catchUp: async () => {
      const here = stayingHere(shown.userId);
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
      const here = stayingHere(shown.userId);

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
