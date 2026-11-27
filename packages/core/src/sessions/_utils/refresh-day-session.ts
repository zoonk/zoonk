import "server-only";
import { type Goal, type StudySessionBlock, prisma } from "@zoonk/db";
import { loadScheduledAnswersForRefresh } from "../../learner/facts/scheduled-answers";
import { loadPlanAtToken } from "../../plans/_utils/plan-token";
import { PlanConflictError, withPlanRetry } from "../../plans/plan-conflict";
import { getItemKey } from "../../plans/planner/plan-items";
import { readBlockPayload } from "../block-payload";
import { loadRebuildMissionFacts, rebuildMissions } from "../missions/rebuild-missions";
import { getKeptBlocks, hasSameBlocks, hasSameContent } from "./day-block-content";
import { getGoalDayMinutes } from "./day-minutes";
import { loadDayPlan } from "./day-plan";
import { withSessionAppendLock } from "./extra-blocks";
import { loadSessionBuildInput } from "./load-build-inputs";
import { oweStartedDaySettlements } from "./owe-started-day-settlements";
import { planStudyDay } from "./plan-study-day";
import { buildRemainingDay } from "./rebuild-day-input";
import { prepareSelectedPlanSave, saveSelectedPlan } from "./save-selected-plan";
import { type SelectedDayPlan, selectDayPlan, selectDayPlanFromContext } from "./selected-day-plan";
import { isSelectedPlanCurrent } from "./selected-plan-current";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/** kept means changes begin next study day; same preserves today's equivalent queue without a notice. */
export type DaySessionRefresh = "kept" | "notBuilt" | "rebuilt" | "same";

type DaySession = { goal: Goal; session: StudySessionRow; timeZone: string };

/** Supply today's selection to preserve its allocation; omitting it fills from the plan's next lessons. */
export async function planRestOfDayWithPlan({
  day,
  kept,
  readSubscription,
  selection,
}: Pick<Parameters<typeof loadDayPlan>[0], "readSubscription" | "selection"> & {
  day: DaySession;
  kept: readonly StudySessionBlock[];
}) {
  const { goal, session, timeZone } = day;

  const context = {
    goal,
    localDate: session.localDate,
    now: new Date(),
    readSubscription,
    readWritingAnswers: (userId: string, goalId: string) =>
      loadScheduledAnswersForRefresh({ goalId, kept, localDate: session.localDate, userId }),
    timeZone,
    userId: session.userId,
  };

  const dayPlan = loadDayPlan({ ...context, selection });
  const keptLessonIds = new Set(kept.flatMap((block) => (block.lessonId ? [block.lessonId] : [])));

  const input = await loadSessionBuildInput({
    ...context,
    dayPlan,
    keepsBlocks: kept.length > 0,
    keepsMock: kept.some((block) => readBlockPayload(block).checkpoint?.mock),
    keptLessonIds,
    savedDay: true,
    selection,
  });

  // The day keeps the shape it opened with: a welcome back stays light, practice keeps its share.
  return {
    ...buildRemainingDay({
      dated: goal.targetDate !== null,
      input: { ...input, freshStart: session.freshStart },
      kept,
      session,
    }),
    plan: await dayPlan,
  };
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

  const context = {
    goal: day.goal,
    localDate: session.localDate,
    now: new Date(),
    timeZone: day.timeZone,
    userId: session.userId,
  };

  // A rest day must not fill from future lessons outside its selected allocation.
  const selection = selected ?? (await selectDayPlan(context)) ?? undefined;

  const minutes = selection
    ? getGoalDayMinutes({
        date: context.localDate,
        goal: context.goal,
        planSettings: selection.state.settings,
      })
    : context.goal.dailyMinutes;

  const kept = getKeptBlocks(session.blocks, selection?.state, minutes > 0);
  const keptIds = new Set(kept.map((block) => block.id));
  const replaced = session.blocks.filter((block) => !keptIds.has(block.id));

  const unstarted = session.status === "planned" && session.startedAt === null && kept.length === 0;

  const {
    blocks: planned,
    plan,
    plannedMinutes,
  } = selection && unstarted
    ? await planStudyDay({ ...context, savedDay: true, selection })
    : await planRestOfDayWithPlan({ day, kept, selection });

  const unchanged = hasSameContent({ anyOrder: kept.length > 0, planned, replaced });

  const persistsPlan =
    selection !== undefined &&
    (selection.computed !== null || selection.inputKeyUpdate !== undefined);

  const prepared = selection
    ? await prepareSelectedPlanSave({ selection, shown: persistsPlan })
    : null;

  const savedVersion = selection
    ? selection.context.plan.version + Number(prepared?.kind === "computed")
    : null;

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
        // Ended days keep their binding.
        if (
          !locked.endedAt &&
          (locked.planVersion !== savedVersion || locked.plannedMinutes !== plannedMinutes)
        ) {
          await transaction.studySession.update({
            data: { planVersion: savedVersion, plannedMinutes },
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
            ...(locked.endedAt && { extra: true }),
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
          plannedMinutes: locked.endedAt ? locked.plannedMinutes : plannedMinutes,
          ...(missions && { missions }),
          ...(reopens && { status: "active" }),
        },
        where: { id: session.id },
      });

      await oweStartedDaySettlements(transaction, planned.length > 0 ? [] : replaced);

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
