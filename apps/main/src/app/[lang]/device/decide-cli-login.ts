import { authClient } from "@zoonk/auth/client";
import { decideCliLoginAction } from "./decide-cli-login-action";

export type CliLoginDecision = "approve" | "deny";

export type CliLoginFailure = "expired" | "failed" | "tooMany" | "used" | "wrong";

export type CliLoginOutcome = "approved" | "denied" | "needsStaff";

export type CliLoginState = { outcome: CliLoginOutcome } | { failure: CliLoginFailure } | null;

type AuthError = { error?: unknown; status: number };

const TOO_MANY_REQUESTS = 429;
const BAD_REQUEST = 400;

function getCheckFailure(error: AuthError): CliLoginFailure {
  if (error.status === TOO_MANY_REQUESTS) {
    return "tooMany";
  }

  if (error.error === "expired_token") {
    return "expired";
  }

  return error.status === BAD_REQUEST ? "wrong" : "failed";
}

/**
 * Claims the code for the signed-in person with the provider's check, then lets core decide it. The
 * check is rate limited (5 per 30 minutes from one address) only over HTTP, so the browser makes it,
 * and only on a press.
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

  const decided = await decideCliLoginAction({ decision, userCode });

  if (decided.status === "notFound") {
    return { failure: "used" };
  }

  return decided.status === "unauthorized" ? { failure: "failed" } : { outcome: decided.status };
}
