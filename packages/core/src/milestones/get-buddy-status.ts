import "server-only";
import { prisma } from "@zoonk/db";
import {
  type BeltLevelResult,
  calculateBeltLevel,
  getBeltStartBrainPower,
} from "@zoonk/utils/belt-level";
import {
  type BuddyEnergyState,
  type BuddyStage,
  getBuddyEnergyState,
  getBuddyStage,
  getNextBuddyStage,
} from "@zoonk/utils/buddy";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { getStartOfLocalDay } from "../learner/_utils/local-time";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getStartOfWeek } from "../plans/planner/plan-calendar";
import { type ResolvedBuddy, resolveProfileBuddy } from "../profile/default-buddy";
import { hasEnergyStarted } from "../progress/_utils/energy-started";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { measureProgress } from "../sessions/_utils/capture-snapshot";
import { findCarriedOverSession } from "../sessions/_utils/current-session";
import { STUDY_SESSION_INCLUDE } from "../sessions/_utils/study-session-access";
import { type Mission, getMissionBonus } from "../sessions/missions";
import { type FirstSteps } from "../sessions/missions/first-steps";
import { getDayFirstSteps } from "../sessions/missions/get-day-first-steps";
import { getDayMissions, hasDayMissionBonus } from "../sessions/missions/get-day-missions";
import { getSession } from "../users/get-session";
import { type BuddyDiet, loadBuddyDiet } from "./_utils/buddy-diet";
import { loadMilestoneCounts } from "./award-milestones";
import { type BuddyStatusInput } from "./contract";
import { type GlassesProgress, getGlassesProgress } from "./milestone-rules";

const DAYS_PER_WEEK = 7;

/** Today's achievable missions and their completion bonus, from the active goal's session. */
type BuddyToday = { fullMeal: { bonus: number; earned: boolean }; missions: Mission[] };

/**
 * The buddy's page: its Energy (and whether it naps, is awake or glows), its stage and how far the
 * next one is, today's missions, what it ate this week and the glasses earned. Stage and glow come
 * from the belt and Energy, and glasses from milestones, so the buddy has no economy of its own.
 * Learners without a saved choice get the default buddy with the same progress.
 */
type BuddyStatus = {
  belt: BeltLevelResult & { totalBrainPower: number };
  /** `current` is null until a day of study has passed: a new buddy has no Energy to show yet. */
  energy: { current: number | null; state: BuddyEnergyState; studiedToday: boolean };
  glasses: GlassesProgress[];
  firstSteps: FirstSteps | null;
  nextStage: { belt: string; brainPowerToGo: number; stage: BuddyStage } | null;
  buddy: ResolvedBuddy;
  stage: BuddyStage;
  thisWeek: BuddyDiet;
  /** Null until today's session exists: reading the buddy never builds one. */
  today: BuddyToday | null;
};

export type BuddyStatusResult =
  | { buddy: BuddyStatus; status: "ready" }
  | { status: "unauthorized" };

/** The active goal, whose time zone decides when the learner's day starts. */
async function findActiveGoal(userId: string) {
  const goalId = await findActiveGoalId(userId);

  return goalId
    ? prisma.goal.findUnique({ select: { id: true, timezone: true }, where: { id: goalId } })
    : null;
}

/** The client's time zone, or the request's, which the top bar and the stats pages read too. */
async function getLearnerTimeZone(timeZone: string | undefined): Promise<string> {
  if (timeZone) {
    return timeZone;
  }

  const request = await getRequestProgressDateContext();
  return request.timeZone;
}

/** The missions of the active goal's session today, read without building the session. */
async function loadToday({
  goalId,
  localDate,
  timeZone,
  userId,
}: {
  goalId: string | null;
  localDate: Date;
  timeZone: string;
  userId: string;
}): Promise<{ today: BuddyToday; firstSteps: FirstSteps | null } | null> {
  const carried = goalId
    ? await findCarriedOverSession({ goalId, now: new Date(), timeZone, userId })
    : null;

  const current = goalId
    ? await prisma.studySession.findUnique({
        include: STUDY_SESSION_INCLUDE,
        where: { userGoalDate: { goalId, localDate, userId } },
      })
    : null;

  const session = carried && !current?.startedAt ? carried : current;

  if (!session) {
    return null;
  }

  const [missions, earned] = await Promise.all([
    getDayMissions({ session, through: new Date(), timeZone }),
    hasDayMissionBonus({ now: new Date(), session, timeZone }),
  ]);

  const firstSteps = await getDayFirstSteps({ missions, session, timeZone });

  return {
    firstSteps,
    today: { fullMeal: { bonus: getMissionBonus(missions), earned }, missions },
  };
}

export async function getBuddyStatus(input: BuddyStatusInput): Promise<BuddyStatusResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const now = new Date();
  const goal = await findActiveGoal(userId);
  const learnerTimeZone = await getLearnerTimeZone(input.timeZone);

  // Energy and the day's study read the learner's clock like the top bar and the stats pages do;
  // today's session belongs to the goal's day, as Today builds it.
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: learnerTimeZone });
  const today = getDateInTimeZone({ date: now, timeZone });
  const sessionTimeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });
  const sessionDate = getDateInTimeZone({ date: now, timeZone: sessionTimeZone });
  const weekStart = getStartOfWeek(today);

  const [profile, progress, todayRow, counts, thisWeek, todayMissions, energyStarted] =
    await Promise.all([
      prisma.userLearningProfile.findUnique({ where: { userId } }),
      measureProgress({ now, timeZone, userId }),
      prisma.dailyProgress.findUnique({ where: { userDate: { date: today, userId } } }),
      loadMilestoneCounts(userId),
      loadBuddyDiet({
        from: getStartOfLocalDay({ localDate: weekStart, timeZone }),
        to: getStartOfLocalDay({
          localDate: new Date(weekStart.getTime() + DAYS_PER_WEEK * MS_PER_DAY),
          timeZone,
        }),
        userId,
      }),
      loadToday({
        goalId: goal?.id ?? null,
        localDate: sessionDate,
        timeZone: sessionTimeZone,
        userId,
      }),
      hasEnergyStarted({ today, userId }),
    ]);

  const belt = calculateBeltLevel(progress.brainPower);
  const next = getNextBuddyStage(belt.color);
  const studiedToday = (todayRow?.timeSpentSeconds ?? 0) > 0;
  const energy = energyStarted ? progress.energy : null;

  return {
    buddy: {
      belt: { ...belt, totalBrainPower: progress.brainPower },
      buddy: resolveProfileBuddy(profile),
      energy: {
        current: energy,
        state: getBuddyEnergyState(energy, { studiedToday }),
        studiedToday,
      },
      firstSteps: todayMissions?.firstSteps ?? null,
      glasses: getGlassesProgress(counts),
      nextStage: next
        ? {
            ...next,
            brainPowerToGo: Math.max(0, getBeltStartBrainPower(next.belt) - progress.brainPower),
          }
        : null,
      stage: getBuddyStage(belt.color),
      thisWeek,
      today: todayMissions?.today ?? null,
    },
    status: "ready",
  };
}
