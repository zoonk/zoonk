"use server";

import { postAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import {
  liveCallAdmissionInputSchema,
  liveCallCloseAllResponseSchema,
} from "@zoonk/core/language/conversations/admission-contract";
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

export type EmergencyStopOutcome =
  | { error: null; message: string; remaining: number }
  | { error: string; message: null; remaining: null };

/** What one batch did, in the admin's words; null when the API answered something else. */
function describeBatch(data: unknown): EmergencyStopOutcome | null {
  const parsed = liveCallCloseAllResponseSchema.safeParse(data);

  if (!parsed.success) {
    return null;
  }

  const { attempted, closed, remaining } = parsed.data;

  const message =
    attempted === 0
      ? "New calls are off. No connection was open."
      : `New calls are off. This batch closed ${closed} of ${attempted}; ${remaining} still open.`;

  return { error: null, message, remaining };
}

/**
 * One emergency batch through the API, where the provider key lives: core turns new calls off
 * first, then asks the provider to close a bounded batch of open connections. Closes the provider
 * doesn't confirm stay open; `remaining` tells the admin whether to run another batch.
 */
export async function runEmergencyStopAction(): Promise<EmergencyStopOutcome> {
  const session = await assertAdmin();

  const response = await postAdminApi({
    body: {},
    path: "/v1/live-calls/close-all",
    sessionToken: session.session.token,
  });

  const outcome = response.ok ? describeBatch(response.data) : null;
  revalidatePath("/live-calls");

  return (
    outcome ?? {
      error: "Could not run the emergency stop. Check that the API is running and try again.",
      message: null,
      remaining: null,
    }
  );
}
