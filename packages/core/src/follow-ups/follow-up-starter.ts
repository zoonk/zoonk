import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { API_URL } from "@zoonk/utils/url";
import { getApiDeploymentHeaders } from "../security/api-deployment";
import { FOLLOW_UP_SECRET_HEADER } from "./follow-up-contract";

type FollowUpStarter = (userId: string) => Promise<unknown>;

declare global {
  /** Next.js bundles instrumentation and routes separately, so a module variable set in `register()` isn't the one routes read. */
  var zoonkFollowUpStarter: FollowUpStarter | undefined;
}

/** For the API, which starts its own writes' follow-ups without a request to itself. */
export function registerFollowUpStarter(starter: FollowUpStarter): void {
  globalThis.zoonkFollowUpStarter = starter;
}

async function askApiToStartFollowUps(userId: string): Promise<void> {
  const secret = process.env.APP_FOLLOW_UP_SECRET;

  if (!secret) {
    logError("APP_FOLLOW_UP_SECRET is missing, so follow-ups wait for the daily sweep.");
    return;
  }

  const { data: response, error } = await safeAsync(async () =>
    fetch(`${API_URL}/internal/follow-ups`, {
      body: JSON.stringify({ userId }),
      cache: "no-store",
      headers: {
        ...(await getApiDeploymentHeaders()),
        "Content-Type": "application/json",
        [FOLLOW_UP_SECRET_HEADER]: secret,
      },
      method: "POST",
    }),
  );

  await response?.body?.cancel();

  if (error || !response.ok) {
    logError(`Could not start learner ${userId}'s follow-ups.`, error ?? response.status);
  }
}

/** A failed start leaves the rows for the learner's next write or the daily sweep. */
export async function startFollowUps(userId: string): Promise<void> {
  const starter = globalThis.zoonkFollowUpStarter;

  if (!starter) {
    await askApiToStartFollowUps(userId);
    return;
  }

  const { error } = await safeAsync(() => starter(userId));

  if (error) {
    logError(`Could not start learner ${userId}'s follow-ups.`, error);
  }
}
