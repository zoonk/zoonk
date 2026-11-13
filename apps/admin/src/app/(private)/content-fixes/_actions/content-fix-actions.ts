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
  | { status: "changed" | "failed" | "needsPasskey" };

/** The challenge is stored on the selected fixes; only applying them has to run in the API. */
export async function startContentFixApprovalAction(input: {
  batchId: string;
  fixIds: string[];
}): Promise<ApprovalStart> {
  await assertAdmin();
  const result = await getContentFixApprovalOptions(input);

  if (result.status === "ready" || result.status === "needsPasskey") {
    return result;
  }

  if (result.status === "changed") {
    showDecision();
    return { status: "changed" };
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
 * Applies fixes in the API, which is the app that tells Main its cached content changed. The
 * approver's own session token authorizes it there, and core checks the passkey assertion.
 */
async function decideInApi({
  batchId,
  body,
}: {
  batchId: string;
  body: Record<string, unknown>;
}): Promise<ApprovalOutcome> {
  const session = await assertAdmin();

  if (!isUuid(batchId)) {
    return { status: "failed" };
  }

  const response = await postAdminApi({
    body,
    path: `/v1/content-fix-batches/${batchId}/decisions`,
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

export async function approveContentFixesAction(input: {
  assertion: unknown;
  batchId: string;
}): Promise<ApprovalOutcome> {
  const assertion = passkeyAssertionSchema.safeParse(input.assertion);

  return assertion.success
    ? decideInApi({
        batchId: input.batchId,
        body: { assertion: assertion.data, decision: "approve" },
      })
    : { status: "failed" };
}

/** Finishes what this approver already approved with a passkey, such as after a crash. */
export async function resumeContentFixesAction(batchId: string): Promise<ApprovalOutcome> {
  return decideInApi({ batchId, body: { decision: "resume" } });
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

  const [revert] = result.status === "proposed" ? result.fixes : [];

  if (revert) {
    showDecision();
    redirect(`/content-fixes/${revert.id}`);
  }

  return {
    error:
      "message" in result
        ? result.message
        : "Couldn't propose the revert. Reload the page and try again.",
    submissionId: previousState.submissionId + 1,
  };
}
