import { type Goal, type StudyFreshStart } from "@zoonk/db";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { addDays } from "../../plans/planner/plan-calendar";
import { BRAIN_POWER_BONUS, getHyperdriveLevel, scoreAnswers } from "../brain-power";
import { getNextBlock } from "../day-blocks";
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
  lessonPlaceholder?: StudySessionView["lessonPlaceholder"];
  lessonRoom?: boolean;
  missions: readonly Pick<Mission, "status">[];
  outlines?: DayOutlines;
  /** Positions of the day's mocks whose questions aren't ready yet. */
  preparing?: ReadonlySet<number>;
  sessionBar: StudySessionView["sessionBar"];
  session: {
    blocks: readonly DayBlockInput[];
    endedAt?: Date | null;
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

const NO_POSITIONS: ReadonlySet<number> = new Set();

/** Accepts planned and persisted days without creating a session row. */
export function toDayViewFields({
  answers,
  current,
  dayEndsAt,
  dayMinutes,
  examAccess,
  lessonPlaceholder = null,
  lessonRoom = false,
  missions,
  outlines = null,
  preparing = NO_POSITIONS,
  session,
  sessionBar,
  timeZone = "UTC",
  week,
}: DayViewFieldsInput): Omit<
  StudySessionView,
  "alternativePosition" | "blocks" | "id" | "missions" | "nextBlockId" | "state" | "status"
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
    lessonPlaceholder,
    lessonsComing: lessons.lessonsComing,
    lessonsToPrepare: lessons.lessonsToPrepare,
    localDate: session.localDate,
    minutes: getSessionMinutes({
      blocks: session.blocks,
      dailyGoal: dayMinutes,
      endedAt: session.endedAt,
      planned: session.plannedMinutes,
      reserved: lessonRoom,
    }),
    nextPosition:
      getNextBlock(
        session.blocks.map((block) => ({ ...block, preparing: preparing.has(block.position) })),
      )?.position ?? null,
    pauseSuggested: shouldSuggestPause(answers.map((answer) => answer.isCorrect)),
    sessionBar,
    week: { days: week.days, nextStudyDate: week.nextStudyDate },
  };
}
