import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import {
  type UsageTotals,
  getUsageCounts,
  loadUsageTotals,
} from "../../entitlements/_utils/usage-counts";
import { readExamPicks } from "../../exams/choices/exam-choices";
import { loadListeningSkillIds } from "../../exams/listening/listening-skills";
import { type GoalPlan, getSkillOwners, loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { getLearnerTier } from "../../lookahead/learner-lookahead";
import { listReadyMistakes } from "../../mistakes/mistake-availability";
import {
  type PracticeMistake,
  loadPracticeMistakes,
} from "../../mistakes/mistake-practice-eligibility";
import { type loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
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

/** Language unit titles may require the library because their plan skills do not carry them. */
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
  listeningSkillIds,
  readMistakes,
  timeZone,
  userId,
}: {
  goal: Goal;
  goalPlan: GoalPlan;
  listeningSkillIds?: ReadonlySet<string>;
  localDate: Date;
  readMistakes?: () => Promise<PracticeMistake[]>;
  timeZone: string;
  userId: string;
}) {
  const mistakes = readMistakes
    ? await readMistakes()
    : await loadPracticeMistakes({
        goal,
        listeningSkillIds: listeningSkillIds ?? (await loadListeningSkillIds(goal.id)),
        ownerOf: getSkillOwners(goalPlan.skills),
        userId,
      });

  return listReadyMistakes({ localDate, mistakes, timeZone });
}

type MissionContext = Pick<
  Parameters<typeof loadDayMissionFacts>[0],
  "dayPlan" | "goal" | "localDate" | "readUsage" | "selection" | "userId"
> & { now: Date };

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
  const { dayPlan, goal, localDate, now, readUsage, selection, userId } = input;

  const [plan, goalPlan, tier, limit, recent, usage] = await Promise.all([
    readMissionPlan(input),
    dayPlan?.goalPlan ?? loadGoalPlan(goal.id, selection?.source),
    dayPlan?.tier ?? getLearnerTier(userId),
    dayPlan?.limit ?? loadDailyTimeLimitStatus({ date: localDate, userId }),
    prisma.studySession.findMany({
      orderBy: [{ localDate: "desc" }, { id: "desc" }],
      take: RECENT_SESSIONS,
      where: { goalId: goal.id, localDate: { lt: localDate }, userId },
    }),
    readUsage ? readUsage() : loadUsageTotals({ client: prisma, now, userId }),
  ]);

  return { goalPlan, limit, plan, recent, tier, usage };
}

/** Internal build-time read. It never starts generation or claims any usage. */
export async function loadDayMissionFacts({
  blocks,
  blueprint,
  dayPlan,
  goal,
  localDate,
  now = new Date(),
  plannedMinutes,
  readMistakes,
  readPreparation,
  readUsage,
  selection,
  timeZone,
  userId,
}: {
  blocks: readonly MissionFactBlock[];
  /** The goal's exam blueprint when a GET already read it; without it, it's read fresh. */
  blueprint?: ExamBlueprint | null;
  dayPlan?: Awaited<ReturnType<typeof loadDayPlan>>;
  goal: Goal;
  localDate: Date;
  now?: Date;
  plannedMinutes: number;
  /** A GET's request-wide practice mistakes; without it, they're read fresh. */
  readMistakes?: () => Promise<PracticeMistake[]>;
  readPreparation?: () => ReturnType<typeof loadPreparationInputs>;
  /** A GET's request-wide usage; without it, it's counted fresh. */
  readUsage?: () => Promise<UsageTotals>;
  selection?: SelectedDayPlan;
  timeZone: string;
  userId: string;
}): Promise<DayMissionFacts> {
  const { plan, goalPlan, tier, limit, recent, usage } = await loadMissionContext({
    dayPlan,
    goal,
    localDate,
    now,
    readUsage,
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

  const [mistakes, language, weakSpot, structure] = await Promise.all([
    readyMistakes({
      goal,
      goalPlan,
      listeningSkillIds: dayPlan?.listeningSkillIds,
      localDate,
      readMistakes,
      timeZone,
      userId,
    }),
    languageCandidates({ blocks, goal, items, now, tier, usage, userId }),
    weakSpotCandidate({ blocks, goal, goalPlan, now, plannedMinutes, readPreparation, userId }),
    loadExamStructure(goal, { blueprint, picks: readExamPicks(plan?.settings) }),
  ]);

  const chapter = finishChapterCandidate({ blocks, goalPlan, items });

  const buddyAllowed = hasMissionAllowance({
    counts: tier === "guest" ? null : getUsageCounts(usage, "tutorMessage"),
    kind: "tutorMessage",
    now,
    tier,
  });

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
