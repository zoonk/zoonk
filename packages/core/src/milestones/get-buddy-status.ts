import "server-only";
import { type BuddyGlasses, type BuddyKind, prisma } from "@zoonk/db";
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
import { getStartOfWeek } from "../plans/planner/plan-calendar";
import { measureProgress } from "../sessions/_utils/capture-snapshot";
import { getSession } from "../users/get-session";
import { type BuddyDiet, loadBuddyDiet } from "./_utils/buddy-diet";
import { loadMilestoneCounts } from "./award-milestones";
import { type BuddyStatusInput } from "./contract";
import { type GlassesProgress, getGlassesProgress } from "./milestone-rules";

const DAYS_PER_WEEK = 7;

/**
 * The buddy's page: its Energy (and whether it naps, is awake or glows), its stage and how far the
 * next one is, what it ate this week and the glasses earned. Stage and glow come from the belt and
 * Energy, and glasses from milestones, so the buddy has no economy of its own. Focus learners
 * without a buddy get the same numbers with `buddy` null.
 */
type BuddyStatus = {
  belt: BeltLevelResult & { totalBrainPower: number };
  energy: { current: number; state: BuddyEnergyState; studiedToday: boolean };
  glasses: GlassesProgress[];
  nextStage: { belt: string; brainPowerToGo: number; stage: BuddyStage } | null;
  buddy: { glasses: BuddyGlasses; kind: BuddyKind; name: string | null } | null;
  stage: BuddyStage;
  thisWeek: BuddyDiet;
};

export type BuddyStatusResult =
  | { buddy: BuddyStatus; status: "ready" }
  | { status: "unauthorized" };

export async function getBuddyStatus(input: BuddyStatusInput): Promise<BuddyStatusResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const now = new Date();
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });
  const today = getDateInTimeZone({ date: now, timeZone });
  const weekStart = getStartOfWeek(today);

  const [profile, progress, todayRow, counts, thisWeek] = await Promise.all([
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
  ]);

  const belt = calculateBeltLevel(progress.brainPower);
  const next = getNextBuddyStage(belt.color);
  const studiedToday = (todayRow?.timeSpentSeconds ?? 0) > 0;

  return {
    buddy: {
      belt: { ...belt, totalBrainPower: progress.brainPower },
      buddy: profile?.buddyKind
        ? { glasses: profile.buddyGlasses, kind: profile.buddyKind, name: profile.buddyName }
        : null,
      energy: {
        current: progress.energy,
        state: getBuddyEnergyState(progress.energy, { studiedToday }),
        studiedToday,
      },
      glasses: getGlassesProgress(counts),
      nextStage: next
        ? {
            ...next,
            brainPowerToGo: Math.max(0, getBeltStartBrainPower(next.belt) - progress.brainPower),
          }
        : null,
      stage: getBuddyStage(belt.color),
      thisWeek,
    },
    status: "ready",
  };
}
