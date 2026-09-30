import "server-only";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { EXPERIENCE_MODE_COOKIE } from "@zoonk/core/profile/mode-cookie";
import { type ExperienceMode, resolveExperienceMode } from "@zoonk/learn/experience-mode";
import { cookies } from "next/headers";

async function getModeCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(EXPERIENCE_MODE_COOKIE)?.value;
}

/** The mode this device keeps (picked here, or the last one its pages showed), or Focus. */
export async function getDeviceExperienceMode(): Promise<ExperienceMode> {
  return resolveExperienceMode({ guestModeCookie: await getModeCookie() });
}

/** The mode a page renders in: the one saved on the profile, else the one picked on this device. */
export async function getExperienceMode(): Promise<ExperienceMode> {
  const [profile, guestModeCookie] = await Promise.all([getLearningProfile(), getModeCookie()]);
  return resolveExperienceMode({ guestModeCookie, profileMode: profile?.experienceMode });
}
