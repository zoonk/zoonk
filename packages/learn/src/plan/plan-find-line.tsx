"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { Button } from "@zoonk/ui/components/button";
import { useLayoutEffect, useRef } from "react";
import { usePlanScreen } from "./plan-context";
import { FindTimeLine } from "./plan-coverage";
import { findSectionControl } from "./plan-editor-sections";
import { FULL_COURSE_SWITCH_ID } from "./plan-full-course";
import {
  type TimeToCoverAnswer,
  getOfferedMinutes,
  readTimeToCover,
  useTimeToCover,
  useTimeToCoverTexts,
} from "./use-time-to-cover";

const FIND_LINE_ID = "plan-editor-find";

const USE_TIME_ID = "plan-editor-use-time";

export const FIND_ACTIONS_ID = "plan-editor-find-actions";

export const MOVE_DATE_ID = "plan-editor-move-date";

export function useFindAnswer(): TimeToCoverAnswer | null {
  const { answered } = useTimeToCover();
  return answered && readTimeToCover(answered);
}

function findFocusTarget({
  answered,
  isGoal,
}: {
  answered: PlanTimeToCover;
  isGoal: boolean;
}): HTMLElement | null {
  const offer = document.querySelector<HTMLElement>(`#${USE_TIME_ID}`);

  if (offer) {
    return offer;
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
 * The returned `ask` marks that this editor asked, so an answer found elsewhere (the Plan's card)
 * moves nothing.
 */
export function useFocusFindAnswer() {
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

    const target = findFocusTarget({ answered, isGoal: goal.kind !== "exam" });
    const line = document.querySelector<HTMLElement>(`#${FIND_LINE_ID}`);

    (target ?? findSectionControl("time") ?? line)?.focus();

    // The answer shows too: on a phone, the latest change pinned at the sheet's foot can cover it.
    line?.scrollIntoView({ block: "nearest" });
  }, [answered, goal.kind, state.status]);

  return () => {
    asked.current = true;
  };
}

/** The editor's block is a live region already, so the line isn't one of its own. */
export function FindLine({
  canFind,
  onAsk,
  onUseTime,
  pending,
}: {
  canFind: boolean;
  onAsk: () => void;
  onUseTime: (minutes: number) => void;
  pending: boolean;
}) {
  const { goal, keepFocus, plan } = usePlanScreen();
  const texts = useTimeToCoverTexts();
  const { answered, find, state } = useTimeToCover();
  const answer = answered && readTimeToCover(answered);
  const offered = getOfferedMinutes(answer);
  const showsDate = goal.kind !== "exam" && answer?.kind !== "covers";
  const dateFound = showsDate ? answered?.fittingDate : null;

  const ask = () => {
    onAsk();
    void find();
  };

  const applyTime = (minutes: number) => {
    onUseTime(minutes);
    // The button goes once its time is the plan's, so the keyboard waits on the picker.
    keepFocus(() => findSectionControl("time"));
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

          {answer?.kind === "none" && answered?.targetDate && <p>{texts.none}</p>}

          {answer?.kind === "none" && answer.everyTopicMinutes !== null && (
            <p>{texts.everyTopic(answer.everyTopicMinutes)}</p>
          )}

          {dateFound && (
            <p>
              {texts.fittingDate({
                dailyMinutes: plan.schedule.dailyMinutes,
                fittingDate: dateFound,
              })}
            </p>
          )}

          {offered !== null && offered !== plan.schedule.shape.weekdays && (
            <Button
              className="self-start"
              disabled={pending}
              focusableWhenDisabled
              id={USE_TIME_ID}
              onClick={() => applyTime(offered)}
              size="sm"
              variant="outline"
            >
              {texts.use(offered)}
            </Button>
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
