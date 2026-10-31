"use client";

import { type GoalView } from "@zoonk/core/goals/contract";
import { getDaySplit } from "@zoonk/core/goals/daily-budget";
import { type PlanTimeAdvice, type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { isWeekend } from "@zoonk/core/plans/week-shape";
import { useState } from "react";
import { getTimeLine } from "../../_utils/time-answer";
import { type PollStatus } from "../../_utils/use-poll";
import {
  type GoalsTogether,
  type StudyWeek,
  asksAboutTime,
  getShownAnswer,
  getShownMinutes,
  toFindWeek,
  toStudyWeek,
  waitsForSuggestion,
} from "./schedule-time";
import { getStartingDays } from "./study-week";
import { usePlanAnswer } from "./use-plan-answer";

export type ScheduleActions = {
  findTimeToCover: (week: StudyWeek) => Promise<PlanTimeToCover | null>;
  getTimeAdvice: (week: StudyWeek & { dailyMinutes: number }) => Promise<PlanTimeAdvice | null>;
};

function hasStopped(status: PollStatus): boolean {
  return status === "failed" || status === "timedOut";
}

function readyAnswer<Answer extends { ready: boolean }>(answer: Answer | null): Answer | null {
  return answer?.ready ? answer : null;
}

/** The weekend has a time of its own only once one is picked: switched on, it starts as the weekdays'. */
function useStudyWeek(goal: GoalView) {
  const [days, setDays] = useState(() => getStartingDays(goal.studyDays));
  const [weekendOn, setWeekendOn] = useState(false);
  const [weekendPicked, setWeekendPicked] = useState<number | null>(null);
  const studiesOnWeekends = days.some((day) => isWeekend(day));

  return {
    days,
    setDays,
    setWeekendOn: (on: boolean) => {
      setWeekendOn(on);
      setWeekendPicked(null);
    },
    setWeekendPicked,
    studiesOnWeekends,
    weekend: studiesOnWeekends && weekendOn ? weekendPicked : null,
    weekendOn,
    weekendPicked,
  };
}

function useFoundTime({
  ask,
  dated,
  days,
  paused,
  planMade,
  weekend,
}: {
  ask: ScheduleActions["findTimeToCover"];
  dated: boolean;
  days: number[];
  paused: boolean;
  planMade: boolean;
  weekend: number | null;
}) {
  const week = toFindWeek({ days, weekend });

  const covering = usePlanAnswer({
    ask: () => ask(week),
    enabled: dated && days.length > 0,
    key: JSON.stringify(week),
    paused,
    planMade,
  });

  const found = readyAnswer(covering.answer);
  const last = readyAnswer(covering.last);

  return {
    covering,
    dated: last ? last.targetDate !== null : dated,
    failed: hasStopped(covering.status),
    first: covering.first,
    found,
    last,
  };
}

export function useSchedule({
  actions,
  dated: datedGuess,
  exam,
  goal,
  paused,
  planMade,
  recommendedMinutes,
  together,
}: {
  actions: ScheduleActions;
  dated: boolean;
  exam: boolean;
  goal: GoalView;
  paused: boolean;
  planMade: boolean;
  recommendedMinutes: number;
  together: GoalsTogether;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [fullCourse, setFullCourse] = useState(false);
  const week = useStudyWeek(goal);
  const hasDays = week.days.length > 0;

  const found = useFoundTime({
    ask: actions.findTimeToCover,
    dated: datedGuess,
    days: week.days,
    paused,
    planMade,
    weekend: week.weekend,
  });

  const { dated } = found;
  const studiesEverything = exam && fullCourse;

  const minutes = getShownMinutes({
    fallback: recommendedMinutes,
    first: found.first,
    found: found.found ?? found.last,
    picked,
    settled: !dated || found.failed,
  });

  const asked = toStudyWeek({
    days: week.days,
    fullCourse: studiesEverything,
    minutes: minutes ?? recommendedMinutes,
    weekend: week.weekend,
  });

  const timeAdvice = usePlanAnswer({
    ask: () => actions.getTimeAdvice({ ...asked, dailyMinutes: minutes ?? recommendedMinutes }),
    enabled:
      hasDays &&
      asksAboutTime({ dated, found: found.found, fullCourse: studiesEverything, minutes }),
    key: JSON.stringify({ ...asked, dailyMinutes: minutes }),
    paused,
    planMade,
  });

  const advice = readyAnswer(timeAdvice.answer);

  const lineAt = (answers: { advice: PlanTimeAdvice | null; found: PlanTimeToCover | null }) =>
    getTimeLine({
      ...answers,
      askFailed: hasStopped(timeAdvice.status),
      dated,
      findFailed: found.failed,
      hasDays,
      minutes,
    });

  const line = lineAt({ advice, found: found.found });

  const lastAnswers = {
    advice: advice ?? readyAnswer(timeAdvice.last),
    found: found.found ?? found.last,
  };

  return {
    advice,
    dated,
    found,
    fullCourse,
    gate: dated ? found.covering : timeAdvice,
    line,
    minutes,
    picked,
    setFullCourse,
    setPicked,
    shown: getShownAnswer({
      last: { found: lastAnswers.found, line: lineAt(lastAnswers) },
      now: { found: found.found, line },
    }),
    split: hasDays && minutes !== null ? getDaySplit({ budget: minutes, ...together }) : null,
    stale:
      hasDays &&
      waitsForSuggestion({ failed: found.failed, first: found.first, found: found.found, picked }),
    timeAdvice,
    week,
  };
}

export type Schedule = ReturnType<typeof useSchedule>;
