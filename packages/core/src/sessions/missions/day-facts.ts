import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { countUsage } from "../../entitlements/_utils/usage-counts";
import { loadListeningSkillIds } from "../../exams/listening/listening-skills";
import { type GoalPlan, getSkillOwners, loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { getGoalField } from "../../library/items/item-field";
import { getLearnerTier } from "../../lookahead/learner-lookahead";
import { filterMistakesWithPracticeMaterial } from "../../mistakes/mistake-practice-eligibility";
import { loadDailyTimeLimitStatus } from "../_utils/daily-time-limit";
import { getGoalDayMinutes } from "../_utils/day-minutes";
import { type loadDayPlan } from "../_utils/day-plan";
import { loadExamStructure } from "../_utils/exam-structure";
import { type SelectedDayPlan } from "../_utils/selected-day-plan";
import { type MissionFactBlock, blockCandidates, finishChapterCandidate } from "./block-candidates";
import { hasMissionAllowance } from "./candidate-allowance";
import { MISSION_RULES, type MissionKind, type MissionPick, readMissionDocument } from "./catalog";
import { type FirstSteps, loadFirstSteps } from "./first-steps";
import { languageCandidates } from "./language-candidates";
import { weakSpotCandidate } from "./weak-spot";

const RECENT_SESSIONS = 7;

function fixCandidate({
  count,
  plannedMinutes,
}: {
  count: number;
  plannedMinutes: number;
}): MissionPick[] {
  if (count === 0) {
    return [];
  }

  return [
    {
      anchor: {},
      detail: { count },
      kind: "fixMistake",
      opens: { kind: "mistakesPractice" },
      total:
        count >= MISSION_RULES.mistakePileSize && plannedMinutes >= MISSION_RULES.roomyDayMinutes
          ? 3
          : 1,
    },
  ];
}

/**
 * The chapter or unit a pick names ("Finish Percentages", a call about a unit), from the library
 * when the plan's skills don't carry it, as a language goal's units don't.
 */
async function withChapterTitles(picks: readonly MissionPick[]): Promise<MissionPick[]> {
  const ids = [
    ...new Set(
      picks.flatMap((pick) =>
        pick.anchor.chapterId && !pick.detail?.chapterTitle ? [pick.anchor.chapterId] : [],
      ),
    ),
  ];

  const chapters =
    ids.length > 0
      ? await prisma.chapter.findMany({
          select: { id: true, title: true },
          where: { id: { in: ids } },
        })
      : [];

  return picks.map((pick) => {
    const title = pick.detail?.chapterTitle
      ? undefined
      : chapters.find((chapter) => chapter.id === pick.anchor.chapterId)?.title;

    return title ? { ...pick, detail: { ...pick.detail, chapterTitle: title } } : pick;
  });
}

export type DayMissionFacts = {
  available: boolean;
  blocks: readonly MissionFactBlock[];
  dailyMinutes: number;
  candidates: MissionPick[];
  firstSteps: FirstSteps | null;
  localDate: Date;
  oldestReadyMistakeAt: Date | null;
  patternExpiresTomorrow: boolean;
  plannedMinutes: number;
  readyMistakeCount: number;
  /** Most recent session first, restricted to this goal. */
  recentPicks: MissionKind[][];
};

async function readyMistakes({
  goal,
  goalPlan,
  localDate,
  listeningSkillIds: knownListeningSkillIds,
  timeZone,
  userId,
}: {
  goal: Goal;
  goalPlan: GoalPlan;
  listeningSkillIds?: ReadonlySet<string>;
  localDate: Date;
  timeZone: string;
  userId: string;
}) {
  const ownerOf = getSkillOwners(goalPlan.skills);

  const [mistakes, listeningSkillIds] = await Promise.all([
    prisma.mistake.findMany({
      orderBy: { createdAt: "asc" },
      where: {
        createdAt: { lt: getStartOfLocalDay({ localDate, timeZone }) },
        skillId: { in: [...ownerOf.keys()] },
        status: "open",
        userId,
      },
    }),
    knownListeningSkillIds ?? loadListeningSkillIds(goal.id),
  ]);

  return filterMistakesWithPracticeMaterial({
    examBlueprintId: goal.examBlueprintId,
    field: getGoalField(goal.details),
    listeningSkillIds,
    mistakes,
    ownerOf,
  });
}

type MissionContext = Pick<
  Parameters<typeof loadDayMissionFacts>[0],
  "dayPlan" | "goal" | "localDate" | "selection" | "userId"
>;

function readMissionPlan({ dayPlan, goal, selection }: MissionContext) {
  if (dayPlan) {
    return { items: dayPlan.items, settings: dayPlan.settings };
  }

  if (selection) {
    return { items: selection.items, settings: selection.state.settings };
  }

  return prisma.plan.findUnique({
    include: { items: { orderBy: { position: "asc" } } },
    where: { goalId: goal.id },
  });
}

async function loadMissionContext(input: MissionContext) {
  const { dayPlan, goal, localDate, selection, userId } = input;

  const [plan, goalPlan, tier, limit, recent] = await Promise.all([
    readMissionPlan(input),
    dayPlan?.goalPlan ?? loadGoalPlan(goal.id, selection?.source),
    dayPlan?.tier ?? getLearnerTier(userId),
    dayPlan?.limit ?? loadDailyTimeLimitStatus({ date: localDate, userId }),
    prisma.studySession.findMany({
      orderBy: [{ localDate: "desc" }, { id: "desc" }],
      take: RECENT_SESSIONS,
      where: { goalId: goal.id, localDate: { lt: localDate }, userId },
    }),
  ]);

  return { goalPlan, limit, plan, recent, tier };
}

/** Internal build-time read. It never starts generation or claims any usage. */
export async function loadDayMissionFacts({
  blocks,
  dayPlan,
  goal,
  localDate,
  now = new Date(),
  plannedMinutes,
  selection,
  timeZone,
  userId,
}: {
  blocks: readonly MissionFactBlock[];
  dayPlan?: Awaited<ReturnType<typeof loadDayPlan>>;
  goal: Goal;
  localDate: Date;
  now?: Date;
  plannedMinutes: number;
  selection?: SelectedDayPlan;
  timeZone: string;
  userId: string;
}): Promise<DayMissionFacts> {
  const { plan, goalPlan, tier, limit, recent } = await loadMissionContext({
    dayPlan,
    goal,
    localDate,
    selection,
    userId,
  });

  const dayMinutes = getGoalDayMinutes({ date: localDate, goal, planSettings: plan?.settings });
  const dailyMinutes = Math.min(dayMinutes, limit.remainingMinutes ?? dayMinutes);

  const available =
    goal.status !== "paused" &&
    goal.status !== "archived" &&
    !limit.reached &&
    blocks.length > 0 &&
    plannedMinutes > 0 &&
    dailyMinutes > 0;

  const recentPicks = recent.map(
    (session) => readMissionDocument(session.missions)?.picks.map((pick) => pick.kind) ?? [],
  );

  const base: DayMissionFacts = {
    available,
    blocks,
    candidates: [],
    dailyMinutes,
    firstSteps: null,
    localDate,
    oldestReadyMistakeAt: null,
    patternExpiresTomorrow: false,
    plannedMinutes,
    readyMistakeCount: 0,
    recentPicks,
  };

  const items = plan?.items ?? [];

  const [mistakes, language, buddyUsage, weakSpot, structure] = await Promise.all([
    readyMistakes({
      goal,
      goalPlan,
      listeningSkillIds: dayPlan?.listeningSkillIds,
      localDate,
      timeZone,
      userId,
    }),
    languageCandidates({ blocks, goal, items, now, tier, userId }),
    tier === "guest" ? null : countUsage({ client: prisma, kind: "tutorMessage", now, userId }),
    weakSpotCandidate({ blocks, goal, goalPlan, now, plannedMinutes, userId }),
    loadExamStructure(goal),
  ]);

  const chapter = finishChapterCandidate({ blocks, goalPlan, items });

  const buddyAllowed = hasMissionAllowance({ counts: buddyUsage, kind: "tutorMessage", now, tier });

  const candidates = await withChapterTitles([
    ...blockCandidates({ blocks, plannedMinutes, tier }),
    ...(chapter ? [chapter] : []),
    ...fixCandidate({ count: mistakes.length, plannedMinutes: dailyMinutes }),
    ...language.candidates,
    ...(buddyAllowed
      ? [{ anchor: {}, kind: "askBuddy" as const, opens: { kind: "buddy" as const }, total: 1 }]
      : []),
    ...(weakSpot ? [weakSpot] : []),
  ]);

  const firstSteps = await loadFirstSteps({
    candidates,
    goal,
    hasEssays:
      candidates.some((candidate) => candidate.kind === "essay") ||
      Boolean(structure?.formats.some((format) => format.kind === "essay")),
    items,
    now,
    tier,
    timeZone,
    userId,
  });

  return {
    ...base,
    candidates,
    firstSteps,
    oldestReadyMistakeAt: mistakes[0]
      ? getDateInTimeZone({ date: mistakes[0].createdAt, timeZone })
      : null,
    patternExpiresTomorrow: language.patternExpiresTomorrow,
    readyMistakeCount: mistakes.length,
  };
}
