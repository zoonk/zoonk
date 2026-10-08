import "server-only";
import { type Goal, type StudySessionBlock, prisma } from "@zoonk/db";
import { getBlockItemIds, readBlockPayload } from "../block-payload";
import { type PlannedBlock, type SessionBuildInput, buildSessionBlocks } from "../session-builder";
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

/** The version of the goal's plan a day is built from; null for a goal without a plan. */
export async function loadPlanVersion(goalId: string): Promise<number | null> {
  const plan = await prisma.plan.findUnique({ select: { version: true }, where: { goalId } });
  return plan?.version ?? null;
}

/** A day holds one review, one practice, one essay and one checkpoint; lessons can be many. */
const ONE_PER_DAY = new Set<StudySessionBlock["kind"]>([
  "checkpoint",
  "practice",
  "produce",
  "review",
]);

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

/** The day's build without what the kept blocks already hold: their lessons, questions and kinds. */
function withoutKept({
  input,
  kept,
}: {
  input: SessionBuildInput;
  kept: readonly StudySessionBlock[];
}): SessionBuildInput {
  const kinds = new Set(kept.map((block) => block.kind));
  const lessonIds = new Set(kept.flatMap((block) => (block.lessonId ? [block.lessonId] : [])));
  const itemIds = new Set(kept.flatMap((block) => getBlockItemIds(readBlockPayload(block))));

  const isNewLesson = (lesson: { lessonId: string | null }) =>
    !lesson.lessonId || !lessonIds.has(lesson.lessonId);

  return {
    ...input,
    capsules: kinds.has("review") ? [] : input.capsules,
    checkpoint: kinds.has("checkpoint") ? null : input.checkpoint,
    drills: kinds.has("practice") ? [] : input.drills,
    lessons: input.lessons.filter((lesson) => isNewLesson(lesson)),
    placementItemIds: kinds.has("review") ? [] : input.placementItemIds,
    practice: input.practice.filter((item) => !itemIds.has(item.itemId)),
    // A day that keeps its practice gives the rest of its time to lessons.
    practiceShare: kinds.has("practice") ? 0 : input.practiceShare,
    produce: kinds.has("produce") ? null : input.produce,
    reinforcement: input.reinforcement.filter((lesson) => isNewLesson(lesson)),
    usedMinutes: getKeptMinutes(kept),
  };
}

/** The new blocks for the rest of the day, never a second block of a kind the day keeps. */
async function planRestOfDay({
  day,
  kept,
}: {
  day: DaySession;
  kept: readonly StudySessionBlock[];
}): Promise<PlannedBlock[]> {
  const { goal, session, timeZone } = day;

  const input = await loadSessionBuildInput({
    goal,
    localDate: session.localDate,
    now: new Date(),
    timeZone,
    userId: session.userId,
  });

  // The day keeps the shape it opened with: a welcome back stays light.
  const { blocks } = buildSessionBlocks(
    withoutKept({ input: { ...input, freshStart: session.freshStart }, kept }),
  );

  const keptKinds = new Set(kept.map((block) => block.kind));

  return blocks.filter((block) => !ONE_PER_DAY.has(block.kind) || !keptKinds.has(block.kind));
}

/** What a block holds, to tell a rebuild that changes nothing from one that does. */
function getContent(
  block: Pick<PlannedBlock, "estimatedMinutes" | "kind" | "lessonId" | "payload">,
) {
  return [
    block.kind,
    block.lessonId,
    block.estimatedMinutes,
    ...getBlockItemIds(block.payload),
  ].join(":");
}

function hasSameContent({
  planned,
  replaced,
}: {
  planned: readonly PlannedBlock[];
  replaced: readonly StudySessionBlock[];
}): boolean {
  return (
    planned.length === replaced.length &&
    planned.every((block, index) => {
      const current = replaced[index];

      return (
        current !== undefined &&
        getContent(block) ===
          getContent({
            ...current,
            estimatedMinutes: current.estimatedMinutes ?? 0,
            payload: readBlockPayload(current),
          })
      );
    })
  );
}

function hasSameBlocks({
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
 * meanwhile, the day stays as it was. The session records the plan version it now follows either
 * way, so a day that already follows the plan isn't checked again until the plan changes.
 */
async function replaceNotStartedBlocks({ day }: { day: DaySession }): Promise<DaySessionRefresh> {
  const { session } = day;
  const kept = getKeptBlocks(session.blocks);
  const keptIds = new Set(kept.map((block) => block.id));
  const replaced = session.blocks.filter((block) => !keptIds.has(block.id));
  const planVersion = await loadPlanVersion(day.goal.id);
  const planned = await planRestOfDay({ day, kept });
  const unchanged = hasSameContent({ planned, replaced });

  return withSessionAppendLock({
    run: async ({ session: locked, transaction }) => {
      if (!hasSameBlocks({ locked: locked.blocks, read: session.blocks })) {
        return "kept";
      }

      if (unchanged) {
        await transaction.studySession.update({ data: { planVersion }, where: { id: session.id } });
        return replaced.length > 0 ? "same" : "kept";
      }

      const firstPosition = Math.max(-1, ...kept.map((block) => block.position)) + 1;

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
      const reopens = session.status === "completed" && planned.length > 0;

      await transaction.studySession.update({
        data: {
          planVersion,
          plannedMinutes: getKeptMinutes(kept) + sumMinutes(planned),
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

/**
 * A day built before lessons it held a place for landed: the new lessons join its end, up to the
 * day's time, so a first day that opened short (its lessons still being outlined) fills up without
 * moving anything the learner has seen.
 */
async function appendNewLessons({ day }: { day: DaySession }): Promise<void> {
  const { session } = day;
  const planVersion = await loadPlanVersion(day.goal.id);
  const planned = await planRestOfDay({ day, kept: session.blocks });
  const lessons = planned.filter((block) => block.kind === "learn");

  await withSessionAppendLock({
    run: async ({ session: locked, transaction }) => {
      if (!hasSameBlocks({ locked: locked.blocks, read: session.blocks })) {
        return;
      }

      if (lessons.length === 0) {
        await transaction.studySession.update({ data: { planVersion }, where: { id: session.id } });
        return;
      }

      const firstPosition = Math.max(-1, ...session.blocks.map((block) => block.position)) + 1;

      await transaction.studySessionBlock.createMany({
        data: lessons.map((block, index) => ({
          ...block,
          position: firstPosition + index,
          sessionId: session.id,
        })),
      });

      await transaction.studySession.update({
        data: { planVersion, plannedMinutes: getKeptMinutes(session.blocks) + sumMinutes(lessons) },
        where: { id: session.id },
      });
    },
    session,
  });
}

/**
 * Brings a day built before the plan last changed without the learner (new lessons landing in
 * place of stand-ins, a re-plan) up to date, without changing anything they were shown: what Today
 * showed is what the day holds, started or not, so new lessons only join its end, when it has time
 * left; a day built without blocks (all its lessons still being outlined) is built now; a finished
 * day stays as it is. Only the learner's own change replaces what they haven't started
 * (`followPlanChangeToday`), and that change is announced. It runs on the learner's own read, since
 * building a day needs their session.
 */
export async function refreshDayFromPlan({
  session,
  timeZone,
}: {
  session: StudySessionRow;
  timeZone: string;
}): Promise<StudySessionRow> {
  const { goal } = session;

  if (!goal || session.status === "completed") {
    return session;
  }

  const planVersion = await loadPlanVersion(goal.id);

  if (planVersion === null || session.planVersion === null || planVersion <= session.planVersion) {
    return session;
  }

  const day = { goal, session, timeZone };

  await (session.blocks.length > 0 ? appendNewLessons({ day }) : replaceNotStartedBlocks({ day }));

  return prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: session.id },
  });
}
