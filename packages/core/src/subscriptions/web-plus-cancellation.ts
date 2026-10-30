import "server-only";
import { auth } from "@zoonk/auth";
import { getAuthError } from "@zoonk/auth/errors";
import { safeAsync } from "@zoonk/utils/error";
import { MAIN_URL } from "@zoonk/utils/url";
import { headers } from "next/headers";
import { getSession } from "../users/get-session";

const SUBSCRIPTION_PAGE_URL = new URL("/subscription", MAIN_URL).toString();

/**
 * Stripe's page that cancels the learner's web-bought Plus, which stays until the paid period ends.
 * Null without a session; `none` when they have no active Stripe subscription.
 */
export async function createWebPlusCancellation(): Promise<
  { status: "none" } | { status: "ready"; url: string } | null
> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const { data, error } = await safeAsync(async () =>
    auth.api.cancelSubscription({
      body: { disableRedirect: true, returnUrl: SUBSCRIPTION_PAGE_URL },
      headers: await headers(),
    }),
  );

  if (getAuthError(error)?.code === "SUBSCRIPTION_NOT_FOUND") {
    return { status: "none" };
  }

  if (error) {
    throw error;
  }

  return { status: "ready", url: data.url };
}
