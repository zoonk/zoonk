import { authClient } from "@zoonk/auth/client";

export type CliLoginDecision = "approve" | "deny";

export type CliLoginFailure = "expired" | "failed" | "tooMany" | "used" | "wrong";

export type CliLoginState = { decided: CliLoginDecision } | { failure: CliLoginFailure } | null;

type AuthError = { error?: unknown; status: number };

const TOO_MANY_REQUESTS = 429;
const BAD_REQUEST = 400;
const FORBIDDEN = 403;

function getCheckFailure(error: AuthError): CliLoginFailure {
  if (error.status === TOO_MANY_REQUESTS) {
    return "tooMany";
  }

  if (error.error === "expired_token") {
    return "expired";
  }

  return error.status === BAD_REQUEST ? "wrong" : "failed";
}

function getDecisionFailure(error: AuthError): CliLoginFailure {
  if (error.error === "expired_token") {
    return "expired";
  }

  return error.status === BAD_REQUEST || error.status === FORBIDDEN ? "used" : "failed";
}

/**
 * Claims the code for the signed-in person, then approves or denies it. The claim is the provider's
 * rate-limited check (5 per 30 minutes from one address), so it runs only on a press.
 */
export async function decideCliLogin({
  decision,
  userCode,
}: {
  decision: CliLoginDecision;
  userCode: string;
}): Promise<CliLoginState> {
  const checked = await authClient.device({ query: { user_code: userCode } });

  if (checked.error) {
    return { failure: getCheckFailure(checked.error) };
  }

  // Another person's claim, or a code already approved or denied, leaves nothing for this one to decide.
  if (checked.data.status !== "pending" || !checked.data.client_id) {
    return { failure: "used" };
  }

  const decided =
    decision === "approve"
      ? await authClient.device.approve({ userCode })
      : await authClient.device.deny({ userCode });

  if (decided.error) {
    return { failure: getDecisionFailure(decided.error) };
  }

  return { decided: decision };
}
