import "server-only";
import { type GoalTutorLookUpResult } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { type GoalTutorPage, type TutorLink } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-pages";
import { getWeeklyRecap } from "../../../milestones/get-weekly-recap";
import { type WeekNumbers } from "../../../milestones/weekly-recap";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { getUserProgress } from "../../../progress/progress-metrics";
import { type Mission } from "../../../sessions/missions";
import { type LinkScope, type SavedDay, loadSavedDay, toBlockLink } from "../plan-day-context";
import { type Lookup, toPageLink, toPoints } from "./learner-page-link";

const MAX_MISSIONS = 8;

const MISSION_PAGES: Partial<Record<NonNullable<Mission["opens"]>["kind"], GoalTutorPage>> = {
  mistakesPractice: "mistakesPractice",
  mockChooser: "mockChooser",
  pronunciation: "pronunciation",
};

function toMissionLink({
  day,
  mission,
  scope,
}: {
  day: SavedDay;
  mission: Mission;
  scope: LinkScope;
}): TutorLink | null {
  const { opens } = mission;

  if (mission.status !== "todo" || !opens) {
    return null;
  }

  if (opens.kind === "block") {
    const block = day.view.blocks.find((shown) => shown.id === opens.blockId);
    return block ? toBlockLink({ block, current: day.view.current, scope }) : null;
  }

  const page = MISSION_PAGES[opens.kind];
  return page ? toPageLink({ page, scope }) : null;
}

function getMissionTitle({ detail }: Mission): string | null {
  return detail?.title ?? detail?.chapterTitle ?? detail?.patternTitle ?? detail?.areaTitle ?? null;
}

/** Reads only a saved day and never creates it. */
export async function lookUpMissions({ goal, scope }: Lookup): Promise<GoalTutorLookUpResult> {
  const what = "missions";

  const [day, progress] = await Promise.all([
    loadSavedDay(goal),
    getUserProgress({ userId: goal.userId }),
  ]);

  if (!day || day.view.missions.length === 0) {
    return { status: "notFound", what };
  }

  const { missions } = day.view;

  return {
    bonus: { brainPower: day.view.fullMeal.bonus, earned: day.view.fullMeal.earned },
    brainPower: { today: day.view.brainPower, total: Number(progress?.totalBrainPower ?? 0) },
    date: toIsoDate(day.session.localDate),
    missions: missions
      .slice(0, MAX_MISSIONS)
      .map((mission) => ({
        done: mission.done,
        kind: mission.kind,
        link: toMissionLink({ day, mission, scope }),
        status: mission.status,
        title: getMissionTitle(mission),
        total: mission.total,
      })),
    moreMissions: Math.max(0, missions.length - MAX_MISSIONS),
    status: "found",
    what,
  };
}

function toWeekNumbers(week: WeekNumbers) {
  return {
    averageMinutes: week.averageMinutes,
    daysStudied: week.daysStudied.length,
    minutes: week.minutes,
    questions: week.questions,
  };
}

export async function lookUpWeekly({ goal, scope }: Lookup): Promise<GoalTutorLookUpResult> {
  const what = "weekly";
  const result = await getWeeklyRecap({ goalId: goal.id });

  if (result.status !== "ready") {
    return { status: "notFound", what };
  }

  const { recap } = result;
  const step = recap.turnaround;

  return {
    badges: recap.badges.length,
    biggestStep: step && {
      reason: step.reason,
      rememberedDays: step.rememberedOn.length,
      rightFrom: toPoints(step.from),
      rightTo: toPoints(step.to),
      skill: step.name,
    },
    lastWeek: toWeekNumbers(recap.lastWeek),
    link: toPageLink({ page: "logbook", scope }),
    next: recap.nextFocus?.title ?? null,
    phasesFinished: recap.phasesFinished.map((phase) => phase.name),
    status: "found",
    week: {
      ...toWeekNumbers(recap.week),
      end: toIsoDate(recap.weekEnd),
      finished: recap.ready,
      start: toIsoDate(recap.weekStart),
    },
    what,
  };
}
