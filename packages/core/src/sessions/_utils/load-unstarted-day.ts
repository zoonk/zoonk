import "server-only";
import { loadOftenTestedSkillIds } from "../../exams/map/load-often-tested";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { loadBlockedTestOutChapters } from "../../learner/test-out/_utils/offer-eligibility";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { loadStudyWeek } from "../../progress/_utils/load-study-week";
import { type UnstartedDayView } from "../day-view";
import { hasDayMissionBonus } from "../missions/get-day-missions";
import { asDayMission, loadMissionDayViews } from "../missions/mission-day-views";
import { loadBlockSubjects } from "./block-subjects";
import { loadCatchUpView } from "./catch-up";
import { toDayBlockView } from "./day-block-view";
import { toDayViewFields } from "./day-view-fields";
import { getExamPrepAccess } from "./exam-access";
import { withExtraStudyCheck } from "./extra-blocks";
import { type PlannedStudyDay } from "./plan-study-day";
import { loadDayPlusLessons } from "./plus-only-lessons";
import { type SelectedDayPlan, getSelectedCatchUpItems } from "./selected-day-plan";
import { type SessionDayContext } from "./session-placement";
import { getSessionBar } from "./session-view";

/** Pending lessons must not turn a rest day into an awaiting-content day. */
function getEmptyDay({
  dayMinutes,
  selection,
}: {
  dayMinutes: number;
  selection: SelectedDayPlan;
}) {
  if (dayMinutes === 0) {
    return null;
  }

  return selection.items.some(
    (item) => item.kind === "lesson" && item.status === "todo" && !item.lessonId && !item.chapterId,
  )
    ? "lessonsComing"
    : "nothingNew";
}

/** Read-only display data; never invents session or block ids. */
export async function loadUnstartedDayView({
  context,
  day,
  selection,
}: {
  context: SessionDayContext;
  day: PlannedStudyDay;
  selection: SelectedDayPlan;
}): Promise<UnstartedDayView> {
  const { blueprint, goal, localDate, now, timeZone, userId } = context;

  const blocks = day.blocks.map((block, position) => ({
    ...block,
    brainPower: 0,
    position,
    status: "pending" as const,
  }));

  const missionDay = { blocks, localDate, userId };
  const { dayMinutes, examPrep } = day.plan;
  const examAccess = getExamPrepAccess({ examPrep, goal, timeZone, today: localDate });

  const [
    week,
    subjects,
    oftenTestedSkillIds,
    blockedTestOutChapters,
    missionViews,
    earned,
    plusLessons,
  ] = await Promise.all([
    loadStudyWeek({
      localDate,
      selectedPlan: { goalId: goal.id, settings: selection.state.settings },
      userId,
    }),
    loadBlockSubjects({ blocks, blueprint, goal }),
    loadOftenTestedSkillIds(goal),
    loadBlockedTestOutChapters({
      chapterIds: [...new Set(day.blocks.flatMap((block) => block.payload.chapterId ?? []))],
      goalId: goal.id,
      known: { source: readSavedPlan(userId, goal.id) },
      now,
      timeZone,
      userId,
    }),
    loadMissionDayViews({ picks: day.missions.picks, session: missionDay, through: now, timeZone }),
    hasDayMissionBonus({ now, session: { fullMealAt: null, localDate, userId }, timeZone }),
    loadDayPlusLessons({
      access: examAccess,
      goalId: goal.id,
      items: selection.items,
      localDate,
      userId,
    }),
  ]);

  const missions = missionViews.map((mission) => asDayMission(mission));

  const emptyDay = getEmptyDay({ dayMinutes, selection });

  const hasRoom = dayMinutes - day.plannedMinutes >= DEFAULT_LESSON_MINUTES;

  const fields = toDayViewFields({
    answers: [],
    current: true,
    dailyLimit: day.plan.limit,
    dayMinutes,
    emptyDay,
    examAccess,
    fullMealEarned: earned,
    lessonsComing: hasRoom && emptyDay === "lessonsComing",
    missions,
    plusLessons,
    session: {
      blocks,
      freshStart: day.input.freshStart,
      fullMealAt: null,
      goal,
      goalId: goal.id,
      localDate,
      plannedMinutes: day.plannedMinutes,
    },
    sessionBar: getSessionBar(blocks),
    timeZone,
    week,
  });

  const selectedItems = selection.left.length > 0 ? getSelectedCatchUpItems(selection) : undefined;

  const [catchUp, extraTime] = await Promise.all([
    loadCatchUpView({
      blocks,
      dailyMinutes: goal.dailyMinutes,
      examTomorrow: fields.examTomorrow,
      freshStart: day.input.freshStart,
      goalId: goal.id,
      selectedItems,
      trialEnded: fields.examAccess.trialEnded,
    }),
    withExtraStudyCheck({
      extraTime: fields.extraTime,
      session: { blocks, goal, goalId: goal.id, localDate },
      userId,
    }),
  ]);

  const previewCatchUp = catchUp
    ? { later: catchUp.later, lessonsLeft: catchUp.lessonsLeft, positions: catchUp.positions }
    : null;

  return {
    ...fields,
    blocks: blocks.map((block) =>
      toDayBlockView({
        answeredItemIds: new Set(),
        block,
        blockedTestOutChapters,
        blocks,
        oftenTestedSkillIds,
        subject: subjects.get(block.position) ?? null,
      }),
    ),
    catchUp: previewCatchUp,
    extraTime,
    missions,
    status: "unstarted",
  };
}
