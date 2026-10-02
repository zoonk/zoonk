"use server";

import { requestPlusApproval } from "@zoonk/core/minors/guardian/request-plus-approval";

export type PlusApprovalRequestStatus = Awaited<ReturnType<typeof requestPlusApproval>>["status"];

/** A learner under 18 asks their guardians by email to approve Plus. */
export async function requestPlusApprovalAction(): Promise<PlusApprovalRequestStatus> {
  const result = await requestPlusApproval();
  return result.status;
}
