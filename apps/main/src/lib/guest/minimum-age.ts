import "server-only";
import { cookies } from "next/headers";

const UNDER_MINIMUM_AGE_COOKIE = "zoonk_under_minimum_age";
const TEN_MINUTES_IN_SECONDS = 600;

/**
 * An age under 13 deletes the account, and the onboarding page re-renders without a session in
 * the same response. This short-lived cookie lets that page say goodbye kindly instead of
 * sending them back to the start as if nothing happened.
 */
export async function markUnderMinimumAge() {
  const cookieStore = await cookies();

  cookieStore.set(UNDER_MINIMUM_AGE_COOKIE, "1", {
    httpOnly: true,
    maxAge: TEN_MINUTES_IN_SECONDS,
    path: "/",
    sameSite: "lax",
  });
}

export async function isUnderMinimumAge(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.has(UNDER_MINIMUM_AGE_COOKIE);
}
