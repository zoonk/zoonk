"use server";

import { acceptGuardianInvite } from "@zoonk/core/minors/guardian/accept-invite";
import { approvePlusPurchase } from "@zoonk/core/minors/guardian/approve-plus";
import { guardedLearnerUpdateSchema } from "@zoonk/core/minors/guardian/contract";
import { revokeGuardianLink } from "@zoonk/core/minors/guardian/revoke-link";
import { setGuardianDailyLimit } from "@zoonk/core/minors/guardian/set-daily-limit";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

export type AcceptInviteState = {
  status: "emailNotVerified" | "expired" | "idle" | "notFound" | "unauthorized" | "wrongAccount";
};

/** Accepting needs the invited address signed in; then the guardian lands on their learners. */
export async function acceptInviteAction(
  token: string,
  _state: AcceptInviteState,
): Promise<AcceptInviteState> {
  const result = await acceptGuardianInvite({ token });

  if (result.status === "accepted") {
    redirect(`/auth/guardian?${new URLSearchParams({ accepted: "1" })}`);
  }

  return { status: result.status };
}

export async function setDailyLimitAction({
  dailyLimitMinutes,
  linkId,
}: {
  dailyLimitMinutes: number | null;
  linkId: string;
}): Promise<boolean> {
  const parsed = guardedLearnerUpdateSchema.safeParse({ dailyLimitMinutes });

  if (!parsed.success) {
    return false;
  }

  const result = await setGuardianDailyLimit({ ...parsed.data, linkId });

  if (result.status === "updated") {
    refresh();
  }

  return result.status === "updated";
}

export async function approvePlusAction(linkId: string): Promise<boolean> {
  const result = await approvePlusPurchase({ linkId });

  if (result.status === "approved") {
    refresh();
  }

  return result.status === "approved";
}

/** The guardian ends the link: their view and controls go away, and the learner's limits lift. */
export async function endLinkAction(linkId: string): Promise<boolean> {
  const result = await revokeGuardianLink({ linkId });

  if (result.status === "revoked") {
    refresh();
  }

  return result.status === "revoked";
}
