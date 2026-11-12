"use server";

import { postAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import { type AdminActionState } from "@/lib/use-admin-action-state";
import {
  type PasskeyApprovalOptions,
  passkeyAssertionSchema,
} from "@zoonk/auth/passkey-approval-contract";
import {
  getContentFixApprovalOptions,
  rejectContentFix,
} from "@zoonk/core/staff/content-fixes/decide";
import { proposeContentFixRevertInAdmin } from "@zoonk/core/staff/content-fixes/propose";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/** A decision changes this page, the list and the count in the navigation. */
function showDecision() {
  revalidatePath("/", "layout");
}

export type ApprovalStart =
  | { options: PasskeyApprovalOptions; status: "ready" }
  | { status: "decided" | "failed" | "needsPasskey" };

/** The challenge is stored on the fix; only applying it has to run in the API. */
export async function startContentFixApprovalAction(fixId: string): Promise<ApprovalStart> {
  await assertAdmin();
  const result = await getContentFixApprovalOptions(fixId);

  if (result.status === "ready" || result.status === "needsPasskey") {
    return result;
  }

  if (result.status === "decided") {
    showDecision();
    return { status: "decided" };
  }

  return { status: "failed" };
}

const decisionSchema = z.discriminatedUnion("status", [
  z.object({ cacheNotified: z.boolean().nullable(), status: z.literal("decided") }),
  z.object({ status: z.literal("approvalExpired") }),
  z.object({ status: z.literal("assertionInvalid") }),
]);

export type ApprovalOutcome =
  | { cacheNotified: boolean | null; status: "decided" }
  | { status: "approvalExpired" | "assertionInvalid" | "failed" };

/**
 * Applies the fix in the API, which is the app that tells Main its cached content changed. The
 * approver's own session token authorizes it there, and core checks the passkey assertion.
 */
export async function approveContentFixAction(input: {
  assertion: unknown;
  fixId: string;
}): Promise<ApprovalOutcome> {
  const session = await assertAdmin();
  const assertion = passkeyAssertionSchema.safeParse(input.assertion);

  if (!isUuid(input.fixId) || !assertion.success) {
    return { status: "failed" };
  }

  const response = await postAdminApi({
    body: { assertion: assertion.data, decision: "approve" },
    path: `/v1/content-fixes/${input.fixId}/decisions`,
    sessionToken: session.session.token,
  });

  const decision = decisionSchema.safeParse(response.data);

  if (!response.ok || !decision.success) {
    return { status: "failed" };
  }

  if (decision.data.status === "decided") {
    showDecision();
  }

  return decision.data;
}

export async function rejectContentFixAction(
  previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await assertAdmin();
  const submissionId = previousState.submissionId + 1;
  const result = await rejectContentFix(parseFormField(formData, "fixId") ?? "");

  if (result.status !== "decided") {
    return { error: "Couldn't reject this fix. Reload the page and try again.", submissionId };
  }

  showDecision();
  return { error: null, submissionId };
}

export async function revertContentFixAction(
  previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await assertAdmin();

  const result = await proposeContentFixRevertInAdmin({
    fixId: parseFormField(formData, "fixId") ?? "",
    reason: parseFormField(formData, "reason") ?? "",
  });

  if (result.status === "proposed") {
    showDecision();
    redirect(`/content-fixes/${result.fix.id}`);
  }

  return {
    error:
      "message" in result
        ? result.message
        : "Couldn't propose the revert. Reload the page and try again.",
    submissionId: previousState.submissionId + 1,
  };
}
