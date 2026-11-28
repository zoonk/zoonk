import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type findActiveSubscription } from "../../auth/subscription";
import {
  type UsageTotals,
  getUsageCounts,
  loadUsageTotals,
} from "../../entitlements/_utils/usage-counts";
import { readExamPicks } from "../../exams/choices/exam-choices";
import { loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { getLearnerTier } from "../../lookahead/learner-lookahead";
import { type loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
import { getGoalDayMinutes } from "../_utils/day-minutes";
import { type loadDayPlan } from "../_utils/day-plan";
import { loadExamStructure } from "../_utils/exam-structure";
import { loadPreparingMockPositions } from "../_utils/preparing-mock-blocks";
import { type SelectedDayPlan } from "../_utils/selected-day-plan";
import { type MissionFactBlock, blockCandidates, finishChapterCandidate } from "./block-candidates";
import { hasMissionAllowance } from "./candidate-allowance";
import { type MissionKind, type MissionPick, readMissionDocument } from "./catalog";
import { type FirstSteps, loadFirstSteps } from "./first-steps";
import { languageCandidates } from "./language-candidates";
import { weakSpotCandidate } from "./weak-spot";

const RECENT_SESSIONS = 7;

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
  plannedMinutes: number;
  /** Most recent session first, restricted to this goal. */
  recentPicks: MissionKind[][];
};

type MissionContext = Pick<
  Parameters<typeof loadDayMissionFacts>[0],
  "dayPlan" | "goal" | "localDate" | "readSubscription" | "readUsage" | "selection" | "userId"
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
  const { dayPlan, goal, localDate, now, readSubscription, readUsage, selection, userId } = input;

  const [plan, goalPlan, tier, recent, usage] = await Promise.all([
    readMissionPlan(input),
    dayPlan?.goalPlan ?? loadGoalPlan(goal.id, selection?.source),
    dayPlan?.tier ?? getLearnerTier(userId, readSubscription),
    prisma.studySession.findMany({
      orderBy: [{ localDate: "desc" }, { id: "desc" }],
      take: RECENT_SESSIONS,
      where: { goalId: goal.id, localDate: { lt: localDate }, userId },
    }),
    readUsage ? readUsage() : loadUsageTotals({ client: prisma, now, userId }),
  ]);

  return { goalPlan, plan, recent, tier, usage };
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
  preparing: knownPreparing,
  readPreparation,
  readSubscription,
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
  preparing?: ReadonlySet<number>;
  readPreparation?: () => ReturnType<typeof loadPreparationInputs>;
  readSubscription?: typeof findActiveSubscription;
  /** A GET's request-wide usage; without it, it's counted fresh. */
  readUsage?: () => Promise<UsageTotals>;
  selection?: SelectedDayPlan;
  timeZone: string;
  userId: string;
}): Promise<DayMissionFacts> {
  const { plan, goalPlan, tier, recent, usage } = await loadMissionContext({
    dayPlan,
    goal,
    localDate,
    now,
    readSubscription,
    readUsage,
    selection,
    userId,
  });

  const dayMinutes = getGoalDayMinutes({ date: localDate, goal, planSettings: plan?.settings });
  const dailyMinutes = dayMinutes;

  const available =
    goal.status !== "paused" &&
    goal.status !== "archived" &&
    dailyMinutes > 0 &&
    blocks.length > 0 &&
    plannedMinutes > 0;

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
    plannedMinutes,
    recentPicks,
  };

  const items = plan?.items ?? [];

  const [language, weakSpot, structure, preparing] = await Promise.all([
    languageCandidates({ blocks, goal, items, now, tier, usage, userId }),
    weakSpotCandidate({
      blocks,
      goal,
      goalPlan,
      now,
      plannedMinutes,
      readPreparation,
      readSubscription,
      userId,
    }),
    loadExamStructure(goal, { blueprint, picks: readExamPicks(plan?.settings) }),
    knownPreparing ??
      (tier === "plus"
        ? loadPreparingMockPositions({ blocks, blueprint, goal, localDate })
        : new Set<number>()),
  ]);

  const chapter = finishChapterCandidate({ blocks, goalPlan, items });

  const buddyAllowed = hasMissionAllowance({
    counts: tier === "guest" ? null : getUsageCounts(usage, "tutorMessage"),
    kind: "tutorMessage",
    now,
    tier,
  });

  const candidates = await withChapterTitles([
    ...blockCandidates({ blocks, plannedMinutes, preparing, tier }),
    ...(chapter ? [chapter] : []),
    ...language,
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

  return { ...base, candidates, firstSteps };
}
