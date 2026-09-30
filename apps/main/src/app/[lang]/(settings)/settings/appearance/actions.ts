"use server";

import { experienceModeSchema, learningProfileUpdateSchema } from "@zoonk/core/profile/contract";
import { setExperienceMode } from "@zoonk/core/profile/experience-mode";
import { updateLearningProfile } from "@zoonk/core/profile/update";
import { type AppearanceBuddy } from "@zoonk/learn/appearance";

/** Switches the mode on this device and, with a session, on the profile. Nothing else changes. */
export async function setModeAction(rawMode: unknown): Promise<boolean> {
  const mode = experienceModeSchema.safeParse(rawMode);

  if (!mode.success) {
    return false;
  }

  await setExperienceMode(mode.data);
  return true;
}

/** Saves one change to the profile, after the same validation the public API runs. */
async function saveProfile(input: unknown): Promise<boolean> {
  const parsed = learningProfileUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const result = await updateLearningProfile(parsed.data);
  return result.status === "updated";
}

export async function saveBuddyAction(buddy: AppearanceBuddy): Promise<boolean> {
  return saveProfile({ buddy });
}

export async function setSoundsEnabledAction(soundsEnabled: boolean): Promise<boolean> {
  return saveProfile({ soundsEnabled });
}

export async function setDailyLimitAction(dailyLimitMinutes: number | null): Promise<boolean> {
  return saveProfile({ dailyLimitMinutes });
}

export async function setDeeperByDefaultAction(deeperByDefault: boolean): Promise<boolean> {
  return saveProfile({ deeperByDefault });
}
