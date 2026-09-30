import "server-only";
import { type ExperienceMode } from "@zoonk/db";
import { cookies } from "next/headers";
import { getSession } from "../users/get-session";
import {
  EXPERIENCE_MODE_COOKIE,
  EXPERIENCE_MODE_COOKIE_MAX_AGE_SECONDS,
} from "./experience-mode-cookie";
import { updateLearningProfile } from "./update-learning-profile";

/**
 * Switches the mode on this device, and on the profile when there's a session, so a visitor keeps
 * it after becoming a guest and a learner gets it on every device. Switching changes no learning
 * data. Call it from a Server Action or Route Handler, where cookies can be written.
 */
export async function setExperienceMode(mode: ExperienceMode) {
  const [cookieStore, session] = await Promise.all([cookies(), getSession()]);

  cookieStore.set(EXPERIENCE_MODE_COOKIE, mode, {
    maxAge: EXPERIENCE_MODE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });

  if (session) {
    await updateLearningProfile({ experienceMode: mode });
  }
}
