import "server-only";
import { getSession } from "../users/get-session";
import { acknowledgeStoredNotice } from "./_utils/acknowledge-today-change";
import { revalidatePlanTags } from "./_utils/replan";
import {
  type AcknowledgeTodayPlanChangeInput,
  type AcknowledgeTodayPlanChangeResult,
} from "./today-change-contract";

/** A learner POST acknowledges a saved notice and expires its screen data. */
export async function acknowledgeTodayPlanChange(
  input: AcknowledgeTodayPlanChangeInput,
): Promise<AcknowledgeTodayPlanChangeResult> {
  const actor = await getSession();

  if (!actor) {
    return { status: "unauthorized" };
  }

  const result = await acknowledgeStoredNotice({ changeId: input.changeId, userId: actor.user.id });

  if (result.status === "acknowledged") {
    revalidatePlanTags(actor.user.id);
  }

  return result;
}
