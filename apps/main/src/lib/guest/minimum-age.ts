import "server-only";
import { cookies } from "next/headers";

const UNDER_MINIMUM_AGE_COOKIE = "zoonk_under_minimum_age";
const ONE_DAY_IN_SECONDS = 86_400;

/**
 * An age under 13 deletes the account, and the onboarding page re-renders without a session in
 * the same response. This cookie lets that page say goodbye kindly instead of sending them back to
 * the start as if nothing happened, and for a day it stops the same device from answering again
 * with an older age (`answerOnboardingAction`): an age screen that can be retried until it lets a
 * child in protects nobody (ANPD's draft age-assurance guide, Tabela 4; FTC COPPA FAQ H.3).
 */
export async function markUnderMinimumAge() {
  const cookieStore = await cookies();

  cookieStore.set(UNDER_MINIMUM_AGE_COOKIE, "1", {
    httpOnly: true,
    maxAge: ONE_DAY_IN_SECONDS,
    path: "/",
    sameSite: "lax",
  });
}

export async function isUnderMinimumAge(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.has(UNDER_MINIMUM_AGE_COOKIE);
}
