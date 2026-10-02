"use client";

import { logout as authLogout } from "@zoonk/auth/client";
import { clearExperienceModeCookie } from "@zoonk/core/profile/mode-cookie";
import { resetPostHogUser } from "./posthog";

/**
 * Forgets what this browser keeps about a learner who's leaving, so the next anonymous or
 * shared-device visitor isn't linked to them and doesn't get their mode: the analytics identity,
 * and the mode their pages left for the next hard load's skeleton.
 */
export async function forgetLearnerOnDevice() {
  clearExperienceModeCookie();
  await resetPostHogUser();
}

/** Forgets the learner on this device before ending the Better Auth session. */
export async function logout() {
  await forgetLearnerOnDevice();
  authLogout();
}
