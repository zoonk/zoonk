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
import { getStartOfLocalDay } from "../learner/_utils/local-time";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { readActiveGoal, readLearningProfile } from "../learner/facts/learning-profile";
import { getRequestInstant } from "../learner/facts/request-instant";
import { readUserProgress } from "../learner/facts/user-progress";
import { getStartOfWeek, toIsoDate } from "../plans/planner/plan-calendar";
import { type ResolvedBuddy, resolveProfileBuddy } from "../profile/default-buddy";
import { hasUserLearningProgress } from "../progress/user-progress";
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

/** goalId and localDate identify the mission day, which must match adjacent views. */
type BuddyToday = {
  fullMeal: { bonus: number; earned: boolean };
  goalId: string;
  localDate: string;
  missions: Mission[];
};

type BuddyStatus = {
  belt: BeltLevelResult & { totalBrainPower: number };
  /** `current` is null until the learner has learned something: a new buddy has no Energy yet. */
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

async function loadToday({
  goalId,
  localDate,
  now,
  timeZone,
  userId,
}: {
  goalId: string | null;
  localDate: Date;
  now: Date;
  timeZone: string;
  userId: string;
}): Promise<{ today: BuddyToday; firstSteps: FirstSteps | null } | null> {
  if (!goalId) {
    return null;
  }

  const [carried, current] = await Promise.all([
    findCarriedOverSession({ goalId, now, timeZone, userId }),
    prisma.studySession.findUnique({
      include: STUDY_SESSION_INCLUDE,
      where: { userGoalDate: { goalId, localDate, userId } },
    }),
  ]);

  const session = carried && !current?.startedAt ? carried : current;

  if (!session) {
    return null;
  }

  const [missions, earned] = await Promise.all([
    getDayMissions({ session, through: now, timeZone }),
    hasDayMissionBonus({ now, session, timeZone }),
  ]);

  const firstSteps = await getDayFirstSteps({ missions, session, timeZone });

  return {
    firstSteps,
    today: {
      fullMeal: { bonus: getMissionBonus(missions), earned },
      goalId,
      localDate: toIsoDate(session.localDate),
      missions,
    },
  };
}

export async function getBuddyStatus(input: BuddyStatusInput): Promise<BuddyStatusResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const [now, goal, profile] = await Promise.all([
    getRequestInstant(),
    readActiveGoal(userId),
    readLearningProfile(userId),
  ]);

  // Account study uses the learner's clock; the saved session still belongs to its goal's day.
  const timeZone = getAnswerTimeZone({
    goal: input.timeZone ? null : goal,
    timeZone: input.timeZone,
  });

  const today = getDateInTimeZone({ date: now, timeZone });
  const sessionTimeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });
  const sessionDate = getDateInTimeZone({ date: now, timeZone: sessionTimeZone });
  const weekStart = getStartOfWeek(today);

  const [userProgress, todayRow, counts, thisWeek, todayMissions] = await Promise.all([
    readUserProgress(userId),
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
      now,
      timeZone: sessionTimeZone,
      userId,
    }),
  ]);

  const progress = await measureProgress({ now, progress: userProgress, timeZone, userId });
  const belt = calculateBeltLevel(progress.brainPower);
  const next = getNextBuddyStage(belt.color);
  const studiedToday = (todayRow?.timeSpentSeconds ?? 0) > 0;
  const energy = hasUserLearningProgress(userProgress) ? progress.energy : null;

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
