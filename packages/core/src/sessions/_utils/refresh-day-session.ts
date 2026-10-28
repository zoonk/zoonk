import "server-only";
import { type Goal, type StudySessionBlock, prisma } from "@zoonk/db";
import { loadPlanAtToken } from "../../plans/_utils/plan-token";
import { PlanConflictError, withPlanRetry } from "../../plans/plan-conflict";
import { getItemKey } from "../../plans/planner/plan-items";
import { getBlockItemIds, readBlockPayload } from "../block-payload";
import { loadRebuildMissionFacts, rebuildMissions } from "../missions/rebuild-missions";
import { type PlannedBlock, type SessionBuildInput, buildSessionBlocks } from "../session-builder";
import { ONE_PER_DAY, hasSameContent } from "./day-block-content";
import { loadDayPlan } from "./day-plan";
import { AWAITING_OUTLINES_VERSION, loadDayPlanVersion } from "./day-plan-version";
import { withSessionAppendLock } from "./extra-blocks";
import { loadSessionBuildInput } from "./load-build-inputs";
import { planStudyDay } from "./plan-study-day";
import { prepareSelectedPlanSave, saveSelectedPlan } from "./save-selected-plan";
import { type SelectedDayPlan, selectDayPlan, selectDayPlanFromContext } from "./selected-day-plan";
import { isSelectedPlanCurrent } from "./selected-plan-current";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/** kept means changes begin next study day; same preserves today's equivalent queue without a notice. */
export type DaySessionRefresh = "kept" | "notBuilt" | "rebuilt" | "same";

type DaySession = { goal: Goal; session: StudySessionRow; timeZone: string };

function getKeptBlocks(blocks: readonly StudySessionBlock[]): StudySessionBlock[] {
  return blocks.filter((block) => block.status !== "pending" || readBlockPayload(block).extra);
}

function sumMinutes(blocks: readonly Pick<PlannedBlock, "estimatedMinutes">[]): number {
  return blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0);
}

function getKeptMinutes(blocks: readonly StudySessionBlock[]): number {
  return sumMinutes(blocks.map((block) => ({ estimatedMinutes: block.estimatedMinutes ?? 0 })));
}

/** Preserve opened practice's share only after study begins; unstarted days rebuild whole. */
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

/** Supply today's selection to preserve its allocation; omitting it fills from the plan's next lessons. */
async function planRestOfDayWithPlan({
  day,
  kept,
  selection,
}: {
  day: DaySession;
  kept: readonly StudySessionBlock[];
  selection?: SelectedDayPlan;
}) {
  const { goal, session, timeZone } = day;

  const context = {
    goal,
    localDate: session.localDate,
    now: new Date(),
    timeZone,
    userId: session.userId,
  };

  const dayPlan = loadDayPlan({ ...context, selection });
  const keptLessonIds = new Set(kept.flatMap((block) => (block.lessonId ? [block.lessonId] : [])));

  const input = await loadSessionBuildInput({
    ...context,
    dayPlan,
    keepsBlocks: kept.length > 0,
    keptLessonIds,
    selection,
  });

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

/** Excludes a second block of any kind already kept by the day. */
export async function planRestOfDay(input: {
  selection?: SelectedDayPlan;
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

/** Preserve the session id and started work; a concurrent block start leaves the queue unchanged. */
async function replaceNotStartedBlocks({
  day,
  selection: selected,
}: {
  day: DaySession;
  selection?: SelectedDayPlan;
}): Promise<DaySessionRefresh> {
  const { session } = day;
  const kept = getKeptBlocks(session.blocks);
  const keptIds = new Set(kept.map((block) => block.id));
  const replaced = session.blocks.filter((block) => !keptIds.has(block.id));

  const context = {
    goal: day.goal,
    localDate: session.localDate,
    now: new Date(),
    timeZone: day.timeZone,
    userId: session.userId,
  };

  // A rest day must not fill from future lessons outside its selected allocation.
  const selection = selected ?? (await selectDayPlan(context)) ?? undefined;

  const planVersion = await loadDayPlanVersion({
    goal: day.goal,
    localDate: session.localDate,
    plan: selection
      ? { graph: selection.state.graph, version: selection.context.plan.version }
      : undefined,
  });

  const unstarted = session.status === "planned" && session.startedAt === null && kept.length === 0;

  const { blocks: planned, plan } =
    selection && unstarted
      ? await planStudyDay({ ...context, selection })
      : await planRestOfDayWithPlan({ day, kept, selection });

  const unchanged = hasSameContent({ anyOrder: kept.length > 0, planned, replaced });

  const persistsPlan =
    selection !== undefined &&
    (selection.computed !== null || selection.inputKeyUpdate !== undefined);

  const prepared = selection
    ? await prepareSelectedPlanSave({ selection, shown: persistsPlan })
    : null;

  const savedVersion =
    planVersion === AWAITING_OUTLINES_VERSION || !selection
      ? planVersion
      : selection.context.plan.version + Number(prepared?.kind === "computed");

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
    plan: selection && { id: selection.context.plan.id, write: persistsPlan },
    run: async ({ session: locked, transaction }) => {
      if (
        selection &&
        !(await isSelectedPlanCurrent({
          increment: Number(persistsPlan),
          selection,
          tx: transaction,
        }))
      ) {
        throw new PlanConflictError();
      }

      if (!hasSameBlocks({ locked: locked.blocks, read: session.blocks })) {
        return "kept";
      }

      if (selection && prepared) {
        await saveSelectedPlan({ context: selection.context, prepared, tx: transaction });
      }

      if (unchanged) {
        // Ended days keep their binding; the outline append owns clearing its waiting marker.
        if (
          locked.status !== "completed" &&
          locked.planVersion !== AWAITING_OUTLINES_VERSION &&
          locked.planVersion !== savedVersion
        ) {
          await transaction.studySession.update({
            data: { planVersion: savedVersion },
            where: { id: session.id },
          });
        }

        return replaced.length > 0 ? "same" : "kept";
      }

      const rows = selection?.computed
        ? await transaction.planItem.findMany({ where: { planId: selection.context.plan.id } })
        : (selection?.context.items ?? []);

      const ids = new Map(rows.map((item) => [getItemKey(item), item.id]));

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
          payload: {
            ...block.payload,
            planItemId: block.payload.planItemKey
              ? (ids.get(block.payload.planItemKey) ?? block.payload.planItemId)
              : block.payload.planItemId,
          },
          position: firstPosition + index,
          sessionId: session.id,
        })),
      });

      const reopens = locked.status === "completed" && planned.length > 0;

      await transaction.studySession.update({
        data: {
          planVersion: savedVersion,
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

/** Call after saving a plan change; preserves started work and the session id, reopening completed days when time is added. */
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
  return withPlanRetry(async () => {
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

    const now = new Date();
    const context = await loadPlanAtToken(goalId, { now, timeZone });

    const selection = context
      ? await selectDayPlanFromContext({ context, now, useFreshSaved: true })
      : undefined;

    return replaceNotStartedBlocks({
      day: { goal: context?.goal ?? session.goal, session, timeZone },
      selection,
    });
  });
}
