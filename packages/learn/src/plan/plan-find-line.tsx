"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { useLayoutEffect, useRef } from "react";
import { usePlanScreen } from "./plan-context";
import { FindTimeLine, findPickedChip, findTimeChip } from "./plan-coverage";
import { getEditorSectionId } from "./plan-editor-sections";
import { FULL_COURSE_SWITCH_ID } from "./plan-full-course";
import {
  type TimeToCoverAnswer,
  getOfferedMinutes,
  readTimeToCover,
  useTimeToCover,
  useTimeToCoverTexts,
} from "./use-time-to-cover";

/** The editor's Find line, where focus goes when nothing below it can take it. */
const FIND_LINE_ID = "plan-editor-find";

/** The actions under the editor's answer: moving a goal's date, choosing where to focus. */
export const FIND_ACTIONS_ID = "plan-editor-find-actions";

/** "Move your date to cover everything" in the editor. */
export const MOVE_DATE_ID = "plan-editor-move-date";

/** The find answer of the plan as it is now, in what it says about daily time. */
export function useFindAnswer(): TimeToCoverAnswer | null {
  const { answered } = useTimeToCover();
  return answered && readTimeToCover(answered);
}

/**
 * Where focus goes once the editor's Find answers, since the Find button that had it is gone: the
 * chip of the time it offers (see `getOfferedMinutes`), so Space picks it; Move your date, when
 * it's the one way that covers everything (a goal with a date found); an exam's "Study everything,
 * even after the exam", as onboarding does, when no time covers it; or else the first action
 * below. Null leaves it to the answer itself.
 */
function findFocusTarget({
  answered,
  choices,
  isGoal,
}: {
  answered: PlanTimeToCover;
  choices: number[];
  isGoal: boolean;
}): HTMLElement | null {
  const offered = getOfferedMinutes(readTimeToCover(answered));
  const section = document.querySelector<HTMLElement>(`#${getEditorSectionId("time")}`);

  if (offered !== null) {
    return findTimeChip({ choices, container: section, minutes: offered });
  }

  if (isGoal && answered.fittingDate) {
    return document.querySelector<HTMLElement>(`#${MOVE_DATE_ID}`);
  }

  const studyEverything = isGoal
    ? null
    : document.querySelector<HTMLElement>(`#${FULL_COURSE_SWITCH_ID} [role="switch"]`);

  return studyEverything ?? document.querySelector<HTMLElement>(`#${FIND_ACTIONS_ID} button`);
}

/**
 * Moves focus once this editor's Find answers (see `findFocusTarget`). The returned `ask` marks
 * that this editor asked, so an answer found elsewhere (the Plan's card) moves nothing.
 */
export function useFocusFindAnswer(choices: number[]) {
  const { goal } = usePlanScreen();
  const { answered, state } = useTimeToCover();
  const asked = useRef(false);

  // Before the browser moves on: Find's button gives way to the answer, and the sheet takes focus
  // back from the page on its own, again a frame later, over a focus moved once the answer painted.
  useLayoutEffect(() => {
    if (!asked.current || state.status === "pending") {
      return;
    }

    asked.current = false;

    if (!answered) {
      return;
    }

    const target = findFocusTarget({ answered, choices, isGoal: goal.kind !== "exam" });
    const section = document.querySelector<HTMLElement>(`#${getEditorSectionId("time")}`);

    (
      target ??
      findPickedChip(section) ??
      document.querySelector<HTMLElement>(`#${FIND_LINE_ID}`)
    )?.focus();
  }, [answered, choices, goal.kind, state.status]);

  return () => {
    asked.current = true;
  };
}

/**
 * The editor's Find (see `FindTimeLine`): once found, the time that covers everything by the
 * goal's date, or that no time a day does, with the time that brings every topic in when one does,
 * and, for a goal, the date its own time covers everything by. The editor's block is a live region
 * already, so the line isn't one of its own.
 */
export function FindLine({ canFind, onAsk }: { canFind: boolean; onAsk: () => void }) {
  const { goal, plan } = usePlanScreen();
  const texts = useTimeToCoverTexts();
  const { answered, find, state } = useTimeToCover();
  const answer = answered && readTimeToCover(answered);
  const showsDate = goal.kind !== "exam" && answer?.kind !== "covers";
  const dateFound = showsDate ? answered?.fittingDate : null;

  const ask = () => {
    onAsk();
    void find();
  };

  return (
    <FindTimeLine
      answer={
        <>
          {answer?.kind === "covers" && answered?.targetDate && (
            <p className="font-semibold">
              {texts.covers({
                minutes: answer.minutes,
                targetDate: answered.targetDate,
                targetDateNamedMonth: answered.targetDateNamedMonth,
              })}
            </p>
          )}

          {answer?.kind === "none" && answered?.targetDate && (
            <p>
              {texts.none({
                targetDate: answered.targetDate,
                targetDateNamedMonth: answered.targetDateNamedMonth,
              })}
            </p>
          )}

          {answer?.kind === "none" && answer.coreMinutes !== null && (
            <p>{texts.everyTopic(answer.coreMinutes)}</p>
          )}

          {dateFound && (
            <p>
              {texts.fittingDate({
                dailyMinutes: plan.schedule.dailyMinutes,
                fittingDate: dateFound,
              })}
            </p>
          )}
        </>
      }
      canFind={canFind}
      id={FIND_LINE_ID}
      live={false}
      onFind={ask}
      status={state.status}
    />
  );
}
