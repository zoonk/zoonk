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
import { revalidatePlanTags } from "./_utils/replan";
import { PlanConflictError } from "./plan-conflict";
import { toIsoDate } from "./planner/plan-calendar";
import {
  type AcknowledgeTodayPlanChangeInput,
  type AcknowledgeTodayPlanChangeResult,
  type NoticeBasis,
} from "./today-change-contract";

type ComputedInput = Extract<AcknowledgeTodayPlanChangeInput, { kind: "computed" }>;

/** Whether the day's selection works from the plan Today read when it showed the notice. */
function isNoticeBasis({ basis, selection }: { basis: NoticeBasis; selection: SelectedDayPlan }) {
  const { plan } = selection.context;
  return plan.inputVersion === basis.inputVersion && plan.version === basis.version;
}

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

      const day = toIsoDate(getDateInTimeZone({ date: new Date(), timeZone }));

      if (
        day !== input.shownDate ||
        !(await isSelectedPlanCurrent({ increment: 1, selection, tx }))
      ) {
        throw new NoticeSelectionChangedError();
      }

      await saveSelectedPlan({
        acknowledge: { ...input.basis, studyDay: input.shownDate },
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
    return acknowledgmentResult(replay);
  }

  const goal = await prisma.goal.findFirst({ where: { id: input.goalId, userId } });

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

  const selection = await selectDayPlan({ goal, now, timeZone });

  // Another plan than the one Today read can work out another notice than the one shown.
  if (!selection || !isNoticeBasis({ basis: input.basis, selection })) {
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
  return changeId ? acknowledgmentResult(changeId) : { status: "retryable" };
}

/**
 * One explicit learner POST acknowledges a stored notice or atomically publishes the exact computed
 * one. An acknowledged notice expires the learner's plan reads, so Today shows it answered.
 */
export async function acknowledgeTodayPlanChange(
  input: AcknowledgeTodayPlanChangeInput,
): Promise<AcknowledgeTodayPlanChangeResult> {
  const actor = await getSession();

  if (!actor) {
    return { status: "unauthorized" };
  }

  const result =
    input.kind === "stored"
      ? await acknowledgeStoredNotice({ changeId: input.changeId, userId: actor.user.id })
      : await acknowledgeComputed({ input, userId: actor.user.id });

  if (result.status === "acknowledged") {
    revalidatePlanTags(actor.user.id);
  }

  return result;
}
