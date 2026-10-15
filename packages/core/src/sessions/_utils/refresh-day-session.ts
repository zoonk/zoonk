import "server-only";
import { type Goal, type StudySessionBlock, prisma } from "@zoonk/db";
import { getBlockItemIds, readBlockPayload } from "../block-payload";
import { loadRebuildMissionFacts, rebuildMissions } from "../missions/rebuild-missions";
import { type PlannedBlock, type SessionBuildInput, buildSessionBlocks } from "../session-builder";
import { hasSameContent } from "./day-block-content";
import { loadDayPlan } from "./day-plan";
import { loadDayPlanVersion } from "./day-plan-version";
import { withSessionAppendLock } from "./extra-blocks";
import { loadSessionBuildInput } from "./load-build-inputs";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/**
 * What became of a day's session when its plan changed. `notBuilt`: there's no session yet, so the
 * day is built from the new plan when the learner opens it. `rebuilt`: the part of the day not
 * started yet changed to follow the new plan. `same`: the new plan gives the part not started yet
 * the same blocks, so the day stays as it was without anything to say about it. `kept`: nothing
 * in it could change (every block started or done and no time left, or the learner started a block
 * meanwhile), so the change shows from the next study day.
 */
export type DaySessionRefresh = "kept" | "notBuilt" | "rebuilt" | "same";

type DaySession = { goal: Goal; session: StudySessionRow; timeZone: string };

/**
 * A day holds one review, one practice and one essay; lessons can be many, and so can challenges
 * (each one due today, see `loadSessionBosses`).
 */
export const ONE_PER_DAY: ReadonlySet<StudySessionBlock["kind"]> = new Set<
  StudySessionBlock["kind"]
>(["practice", "produce", "review"]);

/** The blocks a learner's change keeps: those they started or finished. */
function getKeptBlocks(blocks: readonly StudySessionBlock[]): StudySessionBlock[] {
  return blocks.filter((block) => block.status !== "pending");
}

function sumMinutes(blocks: readonly Pick<PlannedBlock, "estimatedMinutes">[]): number {
  return blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0);
}

function getKeptMinutes(blocks: readonly StudySessionBlock[]): number {
  return sumMinutes(blocks.map((block) => ({ estimatedMinutes: block.estimatedMinutes ?? 0 })));
}

/**
 * Practice's share of a day underway as it opened (see `SessionBuildInput.openedPractice`): a day
 * nobody started is built again whole, with practice's share of the day it then has.
 */
function getOpenedPractice({
  kept,
  session,
}: {
  kept: readonly StudySessionBlock[];
  session: StudySessionRow;
}): SessionBuildInput["openedPractice"] {
  const practice = session.blocks.find(
    (block) => block.kind === "practice" && block.status === "pending",
  );

  if (kept.length === 0 || !practice?.estimatedMinutes || session.plannedMinutes <= 0) {
    return undefined;
  }

  return { dayMinutes: session.plannedMinutes, minutes: practice.estimatedMinutes };
}

/** The day's build without what the kept blocks already hold: their lessons, questions and kinds. */
function withoutKept({
  input,
  kept,
  session,
}: {
  input: SessionBuildInput;
  kept: readonly StudySessionBlock[];
  session: StudySessionRow;
}): SessionBuildInput {
  const kinds = new Set(kept.map((block) => block.kind));
  const lessonIds = new Set(kept.flatMap((block) => (block.lessonId ? [block.lessonId] : [])));
  const itemIds = new Set(kept.flatMap((block) => getBlockItemIds(readBlockPayload(block))));

  const keptCheckpoints = new Set(
    kept.flatMap((block) =>
      block.kind === "checkpoint" ? [readBlockPayload(block).planItemId] : [],
    ),
  );

  const isNewLesson = (lesson: { lessonId: string | null }) =>
    !lesson.lessonId || !lessonIds.has(lesson.lessonId);

  return {
    ...input,
    capsules: kinds.has("review") ? [] : input.capsules,
    checkpoints: input.checkpoints.filter(
      (checkpoint) => !keptCheckpoints.has(checkpoint.planItemId),
    ),
    drills: kinds.has("practice") ? [] : input.drills,
    lessons: input.lessons.filter((lesson) => isNewLesson(lesson)),
    openedPractice: getOpenedPractice({ kept, session }),
    placementItemIds: kinds.has("review") ? [] : input.placementItemIds,
    practice: input.practice.filter((item) => !itemIds.has(item.itemId)),
    // A day that keeps its practice gives the rest of its time to lessons.
    practiceShare: kinds.has("practice") ? 0 : input.practiceShare,
    produce: kinds.has("produce") ? null : input.produce,
    reinforcement: input.reinforcement.filter((lesson) => isNewLesson(lesson)),
    usedMinutes: getKeptMinutes(kept),
  };
}

/** The new blocks and the exact plan facts they were built from. */
async function planRestOfDayWithPlan({
  day,
  kept,
}: {
  day: DaySession;
  kept: readonly StudySessionBlock[];
}) {
  const { goal, session, timeZone } = day;

  const context = {
    goal,
    localDate: session.localDate,
    now: new Date(),
    timeZone,
    userId: session.userId,
  };

  /** Share the queue's plan with its missions without a second read or a loading waterfall. */
  const dayPlan = loadDayPlan(context);
  const input = await loadSessionBuildInput({ ...context, dayPlan, keepsBlocks: kept.length > 0 });

  // The day keeps the shape it opened with: a welcome back stays light, practice keeps its share.
  const { blocks } = buildSessionBlocks(
    withoutKept({ input: { ...input, freshStart: session.freshStart }, kept, session }),
  );

  const keptKinds = new Set(kept.map((block) => block.kind));

  return {
    blocks: blocks.filter((block) => !ONE_PER_DAY.has(block.kind) || !keptKinds.has(block.kind)),
    plan: await dayPlan,
  };
}

/** The new blocks for the rest of the day, never a second block of a kind the day keeps. */
export async function planRestOfDay(input: {
  day: DaySession;
  kept: readonly StudySessionBlock[];
}): Promise<PlannedBlock[]> {
  const { blocks } = await planRestOfDayWithPlan(input);
  return blocks;
}

export function hasSameBlocks({
  locked,
  read,
}: {
  locked: readonly StudySessionBlock[];
  read: readonly StudySessionBlock[];
}): boolean {
  return (
    read.length === locked.length &&
    read.every((block, index) => {
      const current = locked[index];
      return current?.id === block.id && current.status === block.status;
    })
  );
}

/**
 * Replaces the day's blocks not kept with the new plan's, after the kept ones, under the session's
 * lock: the session keeps its id, so a screen showing it still reaches it. When a block was started
 * meanwhile, the day stays as it was. Only an actual queue change records the plan version;
 * unchanged content lets the append lock roll back its early revision mark.
 */
async function replaceNotStartedBlocks({ day }: { day: DaySession }): Promise<DaySessionRefresh> {
  const { session } = day;
  const kept = getKeptBlocks(session.blocks);
  const keptIds = new Set(kept.map((block) => block.id));
  const replaced = session.blocks.filter((block) => !keptIds.has(block.id));
  const planVersion = await loadDayPlanVersion({ goal: day.goal, localDate: session.localDate });
  const { blocks: planned, plan } = await planRestOfDayWithPlan({ day, kept });
  const unchanged = hasSameContent({ anyOrder: kept.length > 0, planned, replaced });

  const facts = await loadRebuildMissionFacts({
    blocks: planned,
    dayPlan: plan,
    goal: day.goal,
    kept: kept.length,
    session,
    timeZone: day.timeZone,
    unchanged,
  });

  return withSessionAppendLock({
    run: async ({ session: locked, transaction }) => {
      if (!hasSameBlocks({ locked: locked.blocks, read: session.blocks })) {
        return "kept";
      }

      if (unchanged) {
        return replaced.length > 0 ? "same" : "kept";
      }

      const firstPosition = Math.max(-1, ...kept.map((block) => block.position)) + 1;

      const missions = await rebuildMissions({
        client: transaction,
        facts,
        session: locked,
        timeZone: day.timeZone,
      });

      await transaction.studySessionBlock.deleteMany({
        where: { id: { in: replaced.map((block) => block.id) }, status: "pending" },
      });

      await transaction.studySessionBlock.createMany({
        data: planned.map((block, index) => ({
          ...block,
          position: firstPosition + index,
          sessionId: session.id,
        })),
      });

      // A finished day the change gives more to do opens again, as "10 more minutes" does.
      const reopens = locked.status === "completed" && planned.length > 0;

      await transaction.studySession.update({
        data: {
          planVersion,
          plannedMinutes: getKeptMinutes(kept) + sumMinutes(planned),
          ...(missions && { missions }),
          ...(reopens && { status: "active" }),
        },
        where: { id: session.id },
      });

      return "rebuilt";
    },
    session,
  });
}

/**
 * The learner changed their plan (their own controls, an Apply on a proposal, an undo): the part
 * of today's session they haven't started follows the new plan right away, and time the change
 * adds to a day already done is added to it. What they started or finished stays, and the session
 * keeps its id. Call it after the change is saved: the day is built from the goal as it is now.
 */
export async function followPlanChangeToday({
  goalId,
  localDate,
  timeZone,
  userId,
}: {
  goalId: string;
  /** The learner-local date of the plan's today. */
  localDate: Date;
  timeZone: string;
  userId: string;
}): Promise<DaySessionRefresh> {
  const session = await prisma.studySession.findUnique({
    include: STUDY_SESSION_INCLUDE,
    where: { userGoalDate: { goalId, localDate, userId } },
  });

  if (!session) {
    return "notBuilt";
  }

  if (!session.goal) {
    return "kept";
  }

  return replaceNotStartedBlocks({ day: { goal: session.goal, session, timeZone } });
}
