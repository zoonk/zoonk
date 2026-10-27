"use server";

import { postAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import { liveCallAdmissionInputSchema } from "@zoonk/core/language/conversations/admission-contract";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

const MICROS_PER_DOLLAR = 1_000_000;

export type LiveCallAdmissionState = {
  error: string | null;
  message: string | null;
  submissionId: number;
};

/** The budget is typed in dollars; the setting stores whole micros. Blank or not a number: null. */
function toMicros(dollars: string | null): number | null {
  const value = Number(dollars);
  return dollars?.trim() && Number.isFinite(value) ? Math.round(value * MICROS_PER_DOLLAR) : null;
}

/**
 * Saves who can start new calls and the free accounts' daily budget through the API, which owns
 * the same switch for every client. Reserve reads it fresh, so the next call follows it.
 */
export async function updateLiveCallAdmissionAction(
  previousState: LiveCallAdmissionState,
  formData: FormData,
): Promise<LiveCallAdmissionState> {
  const session = await assertAdmin();
  const submissionId = previousState.submissionId + 1;

  const parsed = liveCallAdmissionInputSchema.safeParse({
    admission: parseFormField(formData, "admission"),
    freeDailyBudgetMicros: toMicros(parseFormField(formData, "freeDailyBudget")),
  });

  if (!parsed.success) {
    return {
      error: "Choose who can start calls and enter a valid daily budget in dollars.",
      message: null,
      submissionId,
    };
  }

  const response = await postAdminApi({
    body: parsed.data,
    path: "/v1/live-calls/admission",
    sessionToken: session.session.token,
  });

  if (!response.ok) {
    return {
      error: "Could not save. Check that the API is running and try again.",
      message: null,
      submissionId,
    };
  }

  revalidatePath("/live-calls");
  return { error: null, message: "Saved. The next call follows it.", submissionId };
}
