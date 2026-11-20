import { type Goal, type StudyFreshStart } from "@zoonk/db";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { addDays } from "../../plans/planner/plan-calendar";
import { BRAIN_POWER_BONUS, getHyperdriveLevel, scoreAnswers } from "../brain-power";
import { getExtraTime } from "../extra-time";
import { type Mission, getMissionBonus, isFullMeal } from "../missions";
import { shouldSuggestPause } from "../pause-suggestion";
import { getSessionMinutes } from "../session-minutes";
import { type DayBlockInput } from "./day-block-view";
import { getDayLessons } from "./empty-day";
import { type ExamPrepAccess } from "./exam-access";
import { isExamTomorrow } from "./exam-tomorrow";
import { type DayOutlines } from "./outlining-stand-ins";
import { type SessionAnswer } from "./session-answers";
import { type SessionWeek, type StudySessionView } from "./session-view";

export type DayViewFieldsInput = {
  answers: readonly SessionAnswer[];
  current: boolean;
  dayEndsAt?: number;
  dayMinutes: number;
  examAccess: ExamPrepAccess;
  lessonRoom?: boolean;
  missions: readonly Pick<Mission, "status">[];
  outlines?: DayOutlines;
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
  week: SessionWeek;
};

export function getNextDayBlock<
  Block extends { status: DayBlockInput["status"]; preparing: boolean },
>(blocks: readonly Block[]): Block | undefined {
  return (
    blocks.find((block) => block.status === "active") ??
    blocks.find((block) => block.status === "pending" && !block.preparing)
  );
}

/** Accepts planned and persisted days without creating a session row. */
export function toDayViewFields({
  answers,
  current,
  dayEndsAt,
  dayMinutes,
  examAccess,
  lessonRoom = false,
  missions,
  outlines = null,
  session,
  sessionBar,
  timeZone = "UTC",
  week,
}: DayViewFieldsInput): Omit<
  StudySessionView,
  "blocks" | "id" | "missions" | "nextBlockId" | "nextPosition" | "state" | "status" | "waitingFor"
> {
  const streak = scoreAnswers({ answers }).streak;
  const lessons = getDayLessons({ blocks: session.blocks, dayMinutes, lessonRoom, outlines });
  const blocksPower = session.blocks.reduce((sum, block) => sum + block.brainPower, 0);

  return {
    brainPower: blocksPower + (session.fullMealAt === null ? 0 : BRAIN_POWER_BONUS.fullMeal),
    catchUp: null,
    current,
    dayEndsAt:
      dayEndsAt ??
      getStartOfLocalDay({ localDate: addDays(session.localDate, 1), timeZone }).getTime(),
    emptyDay: lessons.emptyDay,
    examAccess,
    examTomorrow: isExamTomorrow({ day: session.localDate, goal: session.goal }),
    extraTime: getExtraTime({ blocks: session.blocks, current }),
    freshStart: session.freshStart,
    fullMeal: {
      bonus: getMissionBonus(missions),
      earned: session.fullMealAt !== null,
      ready: isFullMeal(missions),
    },
    goalId: session.goalId,
    hyperdrive: { level: getHyperdriveLevel(streak), streak },
    lessonsComing: lessons.lessonsComing,
    lessonsToPrepare: lessons.lessonsToPrepare,
    localDate: session.localDate,
    minutes: getSessionMinutes({
      blocks: session.blocks,
      dailyGoal: dayMinutes,
      planned: session.plannedMinutes,
      reserved: lessonRoom,
    }),
    pauseSuggested: shouldSuggestPause(answers.map((answer) => answer.isCorrect)),
    sessionBar,
    week: { days: week.days, nextStudyDate: week.nextStudyDate },
  };
}
