import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import {
  type PreparedSelectedPlanSave,
  prepareSelectedPlanSave,
  saveSelectedPlan,
} from "../sessions/_utils/save-selected-plan";
import { type SelectedDayPlan, selectDayPlan } from "../sessions/_utils/selected-day-plan";
import { isSelectedPlanCurrent } from "../sessions/_utils/selected-plan-current";
import { getSelectedPlanNotice } from "../sessions/_utils/selected-plan-notice";
import { getSession } from "../users/get-session";
import {
  acknowledgeStoredNotice,
  acknowledgmentResult,
  findAcknowledgedRead,
} from "./_utils/acknowledge-today-change";
import { PlanConflictError } from "./_utils/write-plan";
import { toIsoDate } from "./planner/plan-calendar";
import {
  type AcknowledgeTodayPlanChangeInput,
  type AcknowledgeTodayPlanChangeResult,
} from "./today-change-contract";

type ComputedInput = Extract<AcknowledgeTodayPlanChangeInput, { kind: "computed" }>;

class NoticeSelectionChangedError extends Error {
  override name = "NoticeSelectionChangedError";
}

async function persistAcknowledgment({
  input,
  prepared,
  selection,
  timeZone,
  userId,
}: {
  input: ComputedInput;
  prepared: PreparedSelectedPlanSave;
  selection: SelectedDayPlan;
  timeZone: string;
  userId: string;
}): Promise<string | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      await markPlansChanged(tx, { planIds: [selection.context.plan.id] });

      const actor = await tx.user.findUniqueOrThrow({
        select: { learnerRevision: true },
        where: { id: userId },
      });

      const day = toIsoDate(getDateInTimeZone({ date: new Date(), timeZone }));

      if (
        day !== input.shownDate ||
        actor.learnerRevision !== BigInt(input.revision) + 1n ||
        !(await isSelectedPlanCurrent({ increment: 1, selection, tx }))
      ) {
        throw new NoticeSelectionChangedError();
      }

      await saveSelectedPlan({
        acknowledge: { revision: input.revision, studyDay: input.shownDate },
        context: selection.context,
        prepared,
        tx,
      });

      const id = await findAcknowledgedRead({ client: tx, input, userId });

      if (!id) {
        throw new NoticeSelectionChangedError();
      }

      return id;
    });
  } catch (error) {
    if (!(error instanceof NoticeSelectionChangedError) && !(error instanceof PlanConflictError)) {
      throw error;
    }

    return findAcknowledgedRead({ input, userId });
  }
}

async function acknowledgeComputed({
  input,
  userId,
}: {
  input: ComputedInput;
  userId: string;
}): Promise<AcknowledgeTodayPlanChangeResult> {
  const replay = await findAcknowledgedRead({ input, userId });

  if (replay) {
    return acknowledgmentResult({ changeId: replay, userId });
  }

  const [goal, actor] = await Promise.all([
    prisma.goal.findFirst({ where: { id: input.goalId, userId } }),
    prisma.user.findUniqueOrThrow({ select: { learnerRevision: true }, where: { id: userId } }),
  ]);

  if (!goal) {
    return { status: "notFound" };
  }

  if (goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const now = new Date();
  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });

  if (toIsoDate(getDateInTimeZone({ date: now, timeZone })) !== input.shownDate) {
    return { status: "otherDay" };
  }

  if (String(actor.learnerRevision) !== input.revision) {
    return { status: "retryable" };
  }

  const selection = await selectDayPlan({ goal, now, timeZone });

  if (!selection) {
    return { status: "retryable" };
  }

  const prepared = prepareSelectedPlanSave({ selection, shown: true });

  if (
    !getSelectedPlanNotice({
      change: prepared.kind === "computed" ? prepared.change : null,
      now,
      selection,
    })
  ) {
    return { status: "retryable" };
  }

  const changeId = await persistAcknowledgment({ input, prepared, selection, timeZone, userId });
  return changeId ? acknowledgmentResult({ changeId, userId }) : { status: "retryable" };
}

/** One explicit learner POST acknowledges a stored notice or atomically publishes the exact computed one. */
export async function acknowledgeTodayPlanChange(
  input: AcknowledgeTodayPlanChangeInput,
): Promise<AcknowledgeTodayPlanChangeResult> {
  const actor = await getSession();

  if (!actor) {
    return { status: "unauthorized" };
  }

  return input.kind === "stored"
    ? acknowledgeStoredNotice({ changeId: input.changeId, userId: actor.user.id })
    : acknowledgeComputed({ input, userId: actor.user.id });
}
