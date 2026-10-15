import { type Goal, type StudyFreshStart } from "@zoonk/db";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { addDays } from "../../plans/planner/plan-calendar";
import { type StudyWeek } from "../../progress/_utils/load-study-week";
import { readBlockPayload } from "../block-payload";
import { BRAIN_POWER_BONUS, getHyperdriveLevel, scoreAnswers } from "../brain-power";
import { type WeekDay, getSessionMinutesDone } from "../daily-goal";
import { getExtraTime } from "../extra-time";
import { type DailyTimeLimitStatus } from "../get-daily-time-limit";
import { type Mission, getMissionBonus, isFullMeal } from "../missions";
import { shouldSuggestPause } from "../pause-suggestion";
import { type DayBlockInput } from "./day-block-view";
import { type ExamPrepAccess } from "./exam-access";
import { isExamTomorrow } from "./exam-tomorrow";
import { type SessionAnswer } from "./session-answers";
import { type EmptyDay, type StudySessionView } from "./session-view";

export type DayViewFieldsInput = {
  answers: readonly SessionAnswer[];
  current: boolean;
  dailyLimit: DailyTimeLimitStatus | null;
  dayEndsAt?: number;
  dayMinutes: number;
  emptyDay?: EmptyDay | null;
  examAccess: ExamPrepAccess;
  fullMealEarned?: boolean;
  lessonsComing?: boolean;
  missions: readonly Pick<Mission, "status">[];
  sessionBar: StudySessionView["sessionBar"];
  session: {
    blocks: readonly DayBlockInput[];
    freshStart: StudyFreshStart | null;
    fullMealAt: Date | null;
    goal: Goal | null;
    goalId: string | null;
    localDate: Date;
    plannedMinutes: number;
  };
  timeZone?: string;
  week: StudyWeek;
};

function getNextPosition(
  blocks: readonly Pick<DayBlockInput, "status" | "position">[],
): number | null {
  return (
    (
      blocks.find((block) => block.status === "active") ??
      blocks.find((block) => block.status === "pending")
    )?.position ?? null
  );
}

/**
 * The session's day counts at least its progress (see `getSessionMinutesDone`). A session carried
 * across midnight never fills the new day's ring with the previous day's completed blocks.
 */
function withSessionDay({
  current,
  days,
  done,
  localDate,
}: {
  current: boolean;
  days: readonly WeekDay[];
  done: number;
  localDate: Date;
}): WeekDay[] {
  return days.map((day) => {
    if (!current || day.date.getTime() !== localDate.getTime() || done <= day.minutes) {
      return day;
    }

    return {
      ...day,
      hitGoal: day.hitGoal || (day.goalMinutes > 0 && done >= day.goalMinutes),
      minutes: done,
      studied: true,
    };
  });
}

/** The same day numbers before and after persistence, without inventing a session row. */
export function toDayViewFields({
  answers,
  current,
  dailyLimit,
  dayEndsAt,
  dayMinutes,
  emptyDay = null,
  examAccess,
  fullMealEarned,
  lessonsComing = false,
  missions,
  session,
  sessionBar,
  timeZone = "UTC",
  week,
}: DayViewFieldsInput): Omit<
  StudySessionView,
  "blocks" | "id" | "missions" | "nextBlockId" | "status"
> {
  const streak = scoreAnswers({ answers }).streak;
  const minutesDone = Math.round(getSessionMinutesDone(session.blocks));

  const days = withSessionDay({
    current,
    days: week.days,
    done: minutesDone,
    localDate: session.localDate,
  });

  const blocksPower = session.blocks.reduce((sum, block) => sum + block.brainPower, 0);

  return {
    brainPower: blocksPower + (session.fullMealAt === null ? 0 : BRAIN_POWER_BONUS.fullMeal),
    catchUp: null,
    current,
    dailyLimit,
    dayEndsAt:
      dayEndsAt ??
      getStartOfLocalDay({ localDate: addDays(session.localDate, 1), timeZone }).getTime(),
    emptyDay: session.blocks.length === 0 && dayMinutes > 0 ? emptyDay : null,
    examAccess,
    examTomorrow: isExamTomorrow({ day: session.localDate, goal: session.goal }),
    extraTime: getExtraTime({
      blocks: session.blocks.map((block) => ({
        extra: readBlockPayload(block).extra,
        status: block.status,
      })),
      remainingLimitMinutes: dailyLimit?.remainingMinutes ?? null,
    }),
    freshStart: session.freshStart,
    fullMeal: {
      bonus: getMissionBonus(missions),
      earned: fullMealEarned ?? session.fullMealAt !== null,
      ready: isFullMeal(missions),
    },
    goalId: session.goalId,
    hyperdrive: { level: getHyperdriveLevel(streak), streak },
    lessonsComing: lessonsComing && session.blocks.length > 0,
    localDate: session.localDate,
    minutes: { dailyGoal: dayMinutes, done: minutesDone, planned: session.plannedMinutes },
    nextPosition: getNextPosition(session.blocks),
    pauseSuggested: shouldSuggestPause(answers.map((answer) => answer.isCorrect)),
    sessionBar,
    week: {
      days,
      daysHitGoal: days.filter((day) => day.hitGoal).length,
      studyDays: days.filter((day) => day.goalMinutes > 0).length,
      time: week.time,
    },
  };
}
