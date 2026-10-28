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

const FIND_LINE_ID = "plan-editor-find";

export const FIND_ACTIONS_ID = "plan-editor-find-actions";

export const MOVE_DATE_ID = "plan-editor-move-date";

export function useFindAnswer(): TimeToCoverAnswer | null {
  const { answered } = useTimeToCover();
  return answered && readTimeToCover(answered);
}

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

/** The returned `ask` marks that this editor asked, so an answer found elsewhere (the Plan's card) moves nothing. */
export function useFocusFindAnswer(choices: number[]) {
  const { goal } = usePlanScreen();
  const { answered, state } = useTimeToCover();
  const asked = useRef(false);

  // Before paint and again a frame later: the sheet takes focus back from the page on its own once
  // the answer painted.
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
    const line = document.querySelector<HTMLElement>(`#${FIND_LINE_ID}`);

    (target ?? findPickedChip(section) ?? line)?.focus();

    // The answer shows too: on a phone, the latest change pinned at the sheet's foot can cover it.
    line?.scrollIntoView({ block: "nearest" });
  }, [answered, choices, goal.kind, state.status]);

  return () => {
    asked.current = true;
  };
}

/** The editor's block is a live region already, so the line isn't one of its own. */
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
